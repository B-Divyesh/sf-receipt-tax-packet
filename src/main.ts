import './style.css';
import { sha256 } from './crypto';
import { createVault, deleteReceipt, exportBackup, getConfig, importBackup, listReceipts, openVault, saveReceipt, unlockVault } from './db';
import { createPacket, safeFileName } from './export';
import { BUY_URL, captureLicense, hasCachedLicense, saveLicense, verifyLicense } from './license';
import type { Currency, PacketOptions, VaultReceipt } from './types';

const CATEGORIES = ['Advertising', 'Equipment', 'Insurance', 'Meals', 'Office', 'Professional fees', 'Software', 'Supplies', 'Travel', 'Utilities', 'Other'];
const CURRENCIES: Currency[] = ['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'INR', 'NZD', 'JPY'];

const escapeHtml = (value: string): string => value.replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[character] ?? character);
const formatBytes = (value: number): string => value < 1024 * 1024 ? `${Math.ceil(value / 1024)} KB` : `${(value / 1024 / 1024).toFixed(1)} MB`;
const formatMoney = (cents: number, currency: Currency): string => new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(cents / 100);
const isoToday = (): string => new Date().toISOString().slice(0, 10);

function download(blob: Blob, name: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url; link.download = name; document.body.append(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1_000);
}

class ReceiptApp {
  private root = document.querySelector<HTMLDivElement>('#app')!;
  private db!: IDBDatabase;
  private key: CryptoKey | null = null;
  private receipts: VaultReceipt[] = [];
  private objectUrls: string[] = [];
  private premium = hasCachedLicense();
  private license = captureLicense();
  private online = navigator.onLine;
  private installPrompt: Event | null = null;

  async init(): Promise<void> {
    try {
      this.db = await openVault();
      this.bindGlobalEvents();
      this.renderLocked(Boolean(await getConfig(this.db)));
      if (this.license) void this.reconcileLicense(this.license);
      this.registerServiceWorker();
    } catch (error) {
      this.renderFatal(error);
    }
  }

  private shell(content: string): string {
    return `
      <header class="site-header">
        <a class="wordmark" href="/" aria-label="Receipt Packet home"><span aria-hidden="true">RP/</span> Receipt Packet</a>
        <span class="local-chip">Local only</span>
      </header>
      <div id="network-strip" class="network-strip ${this.online ? 'is-online' : ''}" role="status">${this.online ? 'Ready offline — your vault stays on this device' : 'Offline — capture and export still work'}</div>
      ${content}
      <footer class="site-footer">
        <p>Evidence binder, not tax advice. Your records stay on this device.</p>
        <nav aria-label="Legal"><a href="/privacy/">Privacy</a><a href="/terms/">Terms</a></nav>
        <p class="generated-note">Original hero artwork generated for Receipt Packet with the Param Factory image model.</p>
      </footer>
      <div id="announcer" class="sr-only" aria-live="polite"></div>
      <div id="toast" class="toast" role="status" hidden></div>`;
  }

  private renderLocked(hasVault: boolean): void {
    this.releaseUrls();
    this.root.innerHTML = this.shell(`
      <main id="main" class="entry-grid">
        <section class="entry-copy" aria-labelledby="page-title">
          <p class="eyebrow">Original → line item → handoff</p>
          <h1 id="page-title">Every claim keeps its proof.</h1>
          <p class="lede">Build an accountant-ready packet from original receipt images—without bank access, OCR, or a subscription.</p>
          <ol class="proof-steps">
            <li><strong>Capture</strong><span>Add the original and the claim explanation.</span></li>
            <li><strong>Seal</strong><span>We fingerprint and encrypt it on this device.</span></li>
            <li><strong>Hand off</strong><span>Export PDF + CSV + originals in one ZIP.</span></li>
          </ol>
        </section>
        <picture class="hero-art">
          <source media="(max-width: 720px)" srcset="/assets/receipt-binder-720.webp" />
          <img src="/assets/receipt-binder-1200.webp" width="1200" height="800" alt="An archive folder where three blank receipt originals are linked to three ledger lines" decoding="async" fetchpriority="high" />
        </picture>
        <section class="vault-card" aria-labelledby="vault-title">
          <div class="section-number">01 / Private vault</div>
          <h2 id="vault-title">${hasVault ? 'Unlock your packet' : 'Create your local vault'}</h2>
          <p>${hasVault ? 'Your passphrase decrypts this device only. It is never stored or sent.' : 'Choose a passphrase of at least 10 characters. There is no password reset, so keep it somewhere safe.'}</p>
          <form id="vault-form" novalidate>
            <label for="passphrase">Passphrase</label>
            <input id="passphrase" name="passphrase" type="password" minlength="10" autocomplete="${hasVault ? 'current-password' : 'new-password'}" required aria-describedby="vault-help" />
            ${hasVault ? '' : `<label for="passphrase-confirm">Confirm passphrase</label><input id="passphrase-confirm" name="confirm" type="password" minlength="10" autocomplete="new-password" required />`}
            <p id="vault-help" class="field-help">${hasVault ? 'Stored records remain encrypted until you unlock.' : 'Use 3–4 memorable words. Losing it means losing access.'}</p>
            <p id="vault-error" class="form-error" aria-live="assertive"></p>
            <button class="button primary full" type="submit">${hasVault ? 'Unlock packet' : 'Create encrypted vault'}</button>
          </form>
          <details class="restore-box">
            <summary>Restore an encrypted backup</summary>
            <p>This replaces any vault already on this device. You will need the backup's passphrase.</p>
            <label class="button secondary file-button">Choose backup<input id="restore-input" type="file" accept="application/json,.json" /></label>
          </details>
        </section>
      </main>`);
    this.bindLockEvents(hasVault);
  }

  private bindLockEvents(hasVault: boolean): void {
    document.querySelector<HTMLFormElement>('#vault-form')?.addEventListener('submit', async (event) => {
      event.preventDefault();
      const form = event.currentTarget as HTMLFormElement;
      const button = form.querySelector<HTMLButtonElement>('button')!;
      const error = form.querySelector<HTMLElement>('#vault-error')!;
      const passphrase = new FormData(form).get('passphrase')?.toString() ?? '';
      error.textContent = '';
      if (passphrase.length < 10) { error.textContent = 'Use at least 10 characters.'; return; }
      if (!hasVault && passphrase !== (new FormData(form).get('confirm')?.toString() ?? '')) { error.textContent = 'The passphrases do not match.'; return; }
      button.disabled = true; button.textContent = hasVault ? 'Decrypting…' : 'Encrypting…';
      try {
        const config = await getConfig(this.db);
        this.key = hasVault && config ? await unlockVault(config, passphrase) : await createVault(this.db, passphrase);
        if (navigator.storage?.persist) void navigator.storage.persist();
        await this.loadWorkspace();
      } catch {
        error.textContent = hasVault ? 'That passphrase did not unlock this vault. Try again.' : 'The vault could not be created. Check browser storage and try again.';
        button.disabled = false; button.textContent = hasVault ? 'Unlock packet' : 'Create encrypted vault';
      }
    });
    document.querySelector<HTMLInputElement>('#restore-input')?.addEventListener('change', async (event) => {
      const file = (event.currentTarget as HTMLInputElement).files?.[0];
      if (!file) return;
      if (!confirm('Replace this device’s current vault with the selected encrypted backup?')) return;
      try { await importBackup(this.db, await file.text()); this.key = null; this.renderLocked(true); this.toast('Backup restored. Unlock it with its passphrase.'); }
      catch (error) { this.toast(error instanceof Error ? error.message : 'The backup could not be restored.', true); }
    });
  }

  private async loadWorkspace(): Promise<void> {
    if (!this.key) return;
    this.receipts = (await listReceipts(this.db, this.key)).sort((a, b) => b.date.localeCompare(a.date));
    this.renderWorkspace();
  }

  private renderWorkspace(): void {
    this.releaseUrls();
    const currencies = new Set(this.receipts.map((item) => item.currency));
    const totals = [...currencies].map((currency) => formatMoney(this.receipts.filter((item) => item.currency === currency).reduce((sum, item) => sum + item.amountCents, 0), currency)).join(' · ') || '—';
    this.root.innerHTML = this.shell(`
      <main id="main" class="workbench">
        <div class="workspace-head">
          <div><p class="eyebrow">Encrypted evidence binder</p><h1>Your receipt packet</h1><p class="subline">Every saved line has an unchanged original and SHA-256 fingerprint.</p></div>
          <div class="head-actions"><button id="install-button" class="button quiet" type="button" hidden>Install app</button><button id="lock-button" class="button secondary" type="button">Lock vault</button><button id="add-button" class="button primary" type="button">+ Add receipt</button></div>
        </div>
        <section class="ledger-stats" aria-label="Packet summary">
          <div><span>Originals</span><strong>${this.receipts.length}</strong></div>
          <div><span>Claimed total${currencies.size > 1 ? 's' : ''}</span><strong>${escapeHtml(totals)}</strong></div>
          <div><span>Integrity</span><strong>${this.receipts.length ? '100% linked' : 'Waiting'}</strong></div>
        </section>
        <div class="workspace-grid">
          <section class="ledger" aria-labelledby="ledger-title">
            <div class="section-heading"><div><span class="section-number">02 / Review</span><h2 id="ledger-title">Evidence ledger</h2></div><label class="search-label" for="search">Find a receipt<input id="search" type="search" placeholder="Merchant, note, category" /></label></div>
            <div id="receipt-list">${this.renderReceipts(this.receipts)}</div>
          </section>
          <aside class="export-panel" aria-labelledby="export-title">
            <span class="section-number">03 / Hand off</span><h2 id="export-title">Build the packet</h2>
            <p>Choose a period. Your ZIP includes a PDF index, spreadsheet-ready CSV, integrity guide, and every original.</p>
            <div class="date-row"><label for="from-date">From<input id="from-date" type="date" /></label><label for="to-date">To<input id="to-date" type="date" /></label></div>
            <p id="export-count" class="packet-count">${this.receipts.length} receipt${this.receipts.length === 1 ? '' : 's'} selected</p>
            <div class="premium-fields ${this.premium ? 'is-unlocked' : ''}">
              <div class="premium-label">${this.premium ? '✓ Supporter fields unlocked' : 'Supporter customisation'}</div>
              <label for="packet-title">Cover title<input id="packet-title" type="text" maxlength="60" value="Receipt evidence packet" ${this.premium ? '' : 'disabled'} /></label>
              <label for="prepared-by">Prepared by<input id="prepared-by" type="text" maxlength="60" ${this.premium ? '' : 'disabled'} /></label>
            </div>
            <button id="export-button" class="button primary full" type="button" ${this.receipts.length ? '' : 'disabled'}>Export evidence ZIP</button>
            <p class="field-help">Export is always available. Receipt Packet does not decide whether an expense is deductible.</p>
            <hr />
            <h3>Own your data</h3><p>Save an encrypted backup after each period. It can only be opened with your vault passphrase.</p>
            <button id="backup-button" class="button secondary full" type="button">Download encrypted backup</button>
            <label class="button quiet full file-button">Restore backup<input id="workspace-restore" type="file" accept="application/json,.json" /></label>
            ${this.renderSupporter()}
          </aside>
        </div>
      </main>
      ${this.receiptDialog()}`);
    this.bindWorkspaceEvents();
  }

  private renderReceipts(receipts: VaultReceipt[], filtered = false): string {
    if (!receipts.length && filtered) return `<div class="empty-state"><div class="empty-stamp" aria-hidden="true">?</div><h3>No matching receipts</h3><p>Your evidence is still filed. Clear the search to see every receipt.</p><button class="button secondary" type="button" data-clear-search>Clear search</button></div>`;
    if (!receipts.length) return `<div class="empty-state"><div class="empty-stamp" aria-hidden="true">0</div><h3>No evidence filed yet</h3><p>Add the first original receipt, then record why you are claiming it.</p><button class="button primary" type="button" data-empty-add>+ Add first receipt</button></div>`;
    return `<ol class="receipt-list">${receipts.map((receipt, index) => {
      const url = URL.createObjectURL(receipt.image); this.objectUrls.push(url);
      return `<li class="receipt-row" data-id="${receipt.id}">
        <div class="row-number">${String(index + 1).padStart(2, '0')}</div>
        <img src="${url}" alt="Original receipt from ${escapeHtml(receipt.merchant)}" width="72" height="72" loading="lazy" />
        <div class="row-main"><div class="row-title"><strong>${escapeHtml(receipt.merchant)}</strong><strong>${escapeHtml(formatMoney(receipt.amountCents, receipt.currency))}</strong></div><p>${escapeHtml(receipt.note)}</p><div class="row-meta"><span>${escapeHtml(receipt.date)}</span><span>${escapeHtml(receipt.category)}</span><span class="hash" title="SHA-256 ${receipt.hash}">SHA ${receipt.hash.slice(0, 10)}…</span></div></div>
        <div class="row-actions"><button class="icon-button" type="button" data-view="${receipt.id}" aria-label="View original from ${escapeHtml(receipt.merchant)}">View</button><button class="icon-button" type="button" data-edit="${receipt.id}" aria-label="Edit ${escapeHtml(receipt.merchant)} receipt">Edit</button><button class="icon-button danger" type="button" data-delete="${receipt.id}" aria-label="Delete ${escapeHtml(receipt.merchant)} receipt">Delete</button></div>
      </li>`;
    }).join('')}</ol>`;
  }

  private renderSupporter(): string {
    if (this.premium) return `<div class="support-box unlocked"><p class="eyebrow">Supporter unlocked</p><h3>Thank you for backing local tools.</h3><p>Your PDF cover can include a custom title and preparer name.</p></div>`;
    return `<div class="support-box"><p class="eyebrow">One-time · $19</p><h3>Make the cover yours</h3><p>Support Receipt Packet and unlock custom cover titles and preparer details. Core capture, backup, and packet export stay free.</p><a class="button acid full" href="${BUY_URL}">Buy supporter unlock</a><details><summary>Have a license?</summary><form id="license-form"><label for="license-token">Paste license token</label><input id="license-token" type="text" autocomplete="off" required /><button class="button secondary full" type="submit">Verify license</button><p id="license-status" class="field-help" aria-live="polite"></p></form></details><p class="legal-small">One-time purchase. Sociobot/Dodo is merchant of record; refunds revoke the license. <a href="/terms/">Terms</a> · <a href="/privacy/">Privacy</a></p></div>`;
  }

  private receiptDialog(): string {
    return `<dialog id="receipt-dialog" aria-labelledby="receipt-dialog-title">
      <form id="receipt-form" method="dialog" novalidate>
        <div class="dialog-head"><div><span class="section-number">01 / Capture</span><h2 id="receipt-dialog-title">Add receipt evidence</h2></div><button class="icon-button" value="cancel" type="button" data-close aria-label="Close receipt form">Close</button></div>
        <input type="hidden" name="id" />
        <div id="original-field"><label for="original">Original receipt image <span aria-hidden="true">*</span></label><input id="original" name="original" type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif" capture="environment" aria-describedby="original-help" /><p id="original-help" class="field-help">JPG, PNG, WebP, HEIC; up to 15 MB. The original bytes are preserved.</p></div>
        <div id="existing-original" class="existing-original" hidden></div>
        <div class="form-grid">
          <label for="receipt-date">Receipt date <span aria-hidden="true">*</span><input id="receipt-date" name="date" type="date" required /></label>
          <label for="merchant">Merchant <span aria-hidden="true">*</span><input id="merchant" name="merchant" type="text" maxlength="100" required /></label>
          <label for="amount">Amount <span aria-hidden="true">*</span><input id="amount" name="amount" type="number" min="0.01" max="99999999" step="0.01" inputmode="decimal" required /></label>
          <label for="currency">Currency<select id="currency" name="currency">${CURRENCIES.map((value) => `<option>${value}</option>`).join('')}</select></label>
          <label for="category">Category<select id="category" name="category">${CATEGORIES.map((value) => `<option>${value}</option>`).join('')}</select></label>
          <label class="wide" for="claim-note">Claim explanation <span aria-hidden="true">*</span><textarea id="claim-note" name="note" rows="3" maxlength="500" required aria-describedby="note-help"></textarea><span id="note-help" class="field-help">A factual note for your accountant, such as “Client site train fare.”</span></label>
        </div>
        <p id="receipt-error" class="form-error" aria-live="assertive"></p>
        <div class="dialog-actions"><button class="button quiet" type="button" data-close>Cancel</button><button class="button primary" type="submit">Save receipt</button></div>
      </form>
    </dialog>
    <dialog id="viewer-dialog" aria-labelledby="viewer-title"><div class="dialog-head"><h2 id="viewer-title">Original receipt</h2><button class="icon-button" type="button" data-view-close aria-label="Close original viewer">Close</button></div><div id="viewer-content"></div></dialog>`;
  }

  private bindWorkspaceEvents(): void {
    document.querySelector('#lock-button')?.addEventListener('click', () => { this.key = null; this.receipts = []; this.renderLocked(true); });
    document.querySelector('#add-button')?.addEventListener('click', () => this.openReceipt());
    document.querySelector('[data-empty-add]')?.addEventListener('click', () => this.openReceipt());
    document.querySelector('#receipt-form')?.addEventListener('submit', (event) => void this.submitReceipt(event));
    document.querySelectorAll('[data-close]').forEach((button) => button.addEventListener('click', () => (document.querySelector<HTMLDialogElement>('#receipt-dialog'))?.close()));
    document.querySelectorAll<HTMLElement>('[data-edit]').forEach((button) => button.addEventListener('click', () => this.openReceipt(button.dataset.edit)));
    document.querySelectorAll<HTMLElement>('[data-delete]').forEach((button) => button.addEventListener('click', () => void this.removeReceipt(button.dataset.delete!)));
    document.querySelectorAll<HTMLElement>('[data-view]').forEach((button) => button.addEventListener('click', () => this.viewOriginal(button.dataset.view!)));
    document.querySelector('[data-view-close]')?.addEventListener('click', () => document.querySelector<HTMLDialogElement>('#viewer-dialog')?.close());
    document.querySelector('#search')?.addEventListener('input', (event) => this.filterList((event.currentTarget as HTMLInputElement).value));
    document.querySelectorAll('#from-date, #to-date').forEach((input) => input.addEventListener('change', () => this.updateExportCount()));
    document.querySelector('#export-button')?.addEventListener('click', () => void this.exportPacket());
    document.querySelector('#backup-button')?.addEventListener('click', () => void this.downloadBackup());
    document.querySelector<HTMLInputElement>('#workspace-restore')?.addEventListener('change', (event) => void this.restoreInWorkspace(event.currentTarget as HTMLInputElement));
    document.querySelector<HTMLFormElement>('#license-form')?.addEventListener('submit', (event) => void this.submitLicense(event));
    const install = document.querySelector<HTMLButtonElement>('#install-button');
    if (install && this.installPrompt) { install.hidden = false; install.addEventListener('click', () => this.promptInstall()); }
  }

  private openReceipt(id?: string): void {
    const dialog = document.querySelector<HTMLDialogElement>('#receipt-dialog')!;
    const form = document.querySelector<HTMLFormElement>('#receipt-form')!;
    form.reset();
    (form.elements.namedItem('date') as HTMLInputElement).value = isoToday();
    (form.elements.namedItem('id') as HTMLInputElement).value = id ?? '';
    const receipt = id ? this.receipts.find((item) => item.id === id) : undefined;
    document.querySelector('#receipt-dialog-title')!.textContent = receipt ? 'Edit receipt details' : 'Add receipt evidence';
    const originalField = document.querySelector<HTMLElement>('#original-field')!;
    const existing = document.querySelector<HTMLElement>('#existing-original')!;
    const original = form.elements.namedItem('original') as HTMLInputElement;
    original.required = !receipt; originalField.hidden = Boolean(receipt); existing.hidden = !receipt;
    if (receipt) {
      (form.elements.namedItem('date') as HTMLInputElement).value = receipt.date;
      (form.elements.namedItem('merchant') as HTMLInputElement).value = receipt.merchant;
      (form.elements.namedItem('amount') as HTMLInputElement).value = (receipt.amountCents / 100).toFixed(2);
      (form.elements.namedItem('currency') as HTMLSelectElement).value = receipt.currency;
      (form.elements.namedItem('category') as HTMLSelectElement).value = receipt.category;
      (form.elements.namedItem('note') as HTMLTextAreaElement).value = receipt.note;
      existing.innerHTML = `<strong>Original locked</strong><span>${escapeHtml(receipt.fileName)} · ${formatBytes(receipt.fileSize)} · SHA ${receipt.hash.slice(0, 12)}…</span><small>Delete and re-add to use a different original; this preserves the audit trail.</small>`;
    }
    document.querySelector('#receipt-error')!.textContent = '';
    dialog.showModal();
    requestAnimationFrame(() => (form.elements.namedItem(receipt ? 'date' : 'original') as HTMLElement).focus());
  }

  private async submitReceipt(event: Event): Promise<void> {
    event.preventDefault();
    if (!this.key) return;
    const form = event.currentTarget as HTMLFormElement;
    const data = new FormData(form);
    const error = document.querySelector<HTMLElement>('#receipt-error')!;
    const submit = form.querySelector<HTMLButtonElement>('button[type="submit"]')!;
    const id = data.get('id')?.toString() ?? '';
    const old = id ? this.receipts.find((receipt) => receipt.id === id) : undefined;
    const file = (form.elements.namedItem('original') as HTMLInputElement).files?.[0];
    const amount = Number(data.get('amount'));
    error.textContent = '';
    if (!form.checkValidity()) { form.reportValidity(); return; }
    if (!old && !file) { error.textContent = 'Choose the original receipt image.'; return; }
    if (file && !file.type.startsWith('image/')) { error.textContent = 'Choose a JPG, PNG, WebP, HEIC, or HEIF image.'; return; }
    if (file && file.size > 15 * 1024 * 1024) { error.textContent = 'That image is over 15 MB. Keep the original, but reduce the file size before adding it.'; return; }
    submit.disabled = true; submit.textContent = 'Hashing & encrypting…';
    try {
      const image = old?.image ?? file!;
      const buffer = await image.arrayBuffer();
      const now = new Date().toISOString();
      const receipt: VaultReceipt = {
        id: old?.id ?? crypto.randomUUID(),
        date: data.get('date')!.toString(), merchant: data.get('merchant')!.toString().trim(),
        amountCents: Math.round(amount * 100), currency: data.get('currency')!.toString() as Currency,
        category: data.get('category')!.toString(), note: data.get('note')!.toString().trim(),
        fileName: old?.fileName ?? file!.name, fileType: old?.fileType ?? file!.type,
        fileSize: old?.fileSize ?? file!.size, hash: old?.hash ?? await sha256(buffer), image,
        createdAt: old?.createdAt ?? now, updatedAt: now,
      };
      await saveReceipt(this.db, this.key, receipt);
      document.querySelector<HTMLDialogElement>('#receipt-dialog')?.close();
      await this.loadWorkspace(); this.toast(old ? 'Receipt details updated. Original unchanged.' : 'Receipt encrypted and linked.');
    } catch { error.textContent = 'The receipt could not be saved. Check available device storage and try again.'; }
    finally { submit.disabled = false; submit.textContent = 'Save receipt'; }
  }

  private async removeReceipt(id: string): Promise<void> {
    const receipt = this.receipts.find((item) => item.id === id);
    if (!receipt || !confirm(`Delete “${receipt.merchant}” and its original receipt? This cannot be undone unless it is in a backup.`)) return;
    await deleteReceipt(this.db, id); await this.loadWorkspace(); this.toast('Receipt and local original deleted.');
  }

  private viewOriginal(id: string): void {
    const receipt = this.receipts.find((item) => item.id === id); if (!receipt) return;
    const url = URL.createObjectURL(receipt.image); this.objectUrls.push(url);
    const content = document.querySelector<HTMLElement>('#viewer-content')!;
    content.innerHTML = `<img src="${url}" alt="Original receipt from ${escapeHtml(receipt.merchant)}" /><dl><div><dt>Original filename</dt><dd>${escapeHtml(receipt.fileName)}</dd></div><div><dt>SHA-256 fingerprint</dt><dd class="full-hash">${receipt.hash}</dd></div><div><dt>Size</dt><dd>${formatBytes(receipt.fileSize)}</dd></div></dl><a class="button secondary" href="${url}" download="${escapeHtml(safeFileName(receipt.fileName))}">Download original</a>`;
    document.querySelector<HTMLDialogElement>('#viewer-dialog')?.showModal();
  }

  private filterList(query: string): void {
    const normalized = query.trim().toLowerCase();
    const matches = this.receipts.filter((item) => `${item.merchant} ${item.note} ${item.category} ${item.date}`.toLowerCase().includes(normalized));
    const list = document.querySelector<HTMLElement>('#receipt-list')!;
    this.releaseUrls(); list.innerHTML = this.renderReceipts(matches, Boolean(normalized));
    document.querySelector('[data-clear-search]')?.addEventListener('click', () => {
      const search = document.querySelector<HTMLInputElement>('#search')!;
      search.value = '';
      this.filterList('');
      search.focus();
    });
    document.querySelectorAll<HTMLElement>('[data-edit]').forEach((button) => button.addEventListener('click', () => this.openReceipt(button.dataset.edit)));
    document.querySelectorAll<HTMLElement>('[data-delete]').forEach((button) => button.addEventListener('click', () => void this.removeReceipt(button.dataset.delete!)));
    document.querySelectorAll<HTMLElement>('[data-view]').forEach((button) => button.addEventListener('click', () => this.viewOriginal(button.dataset.view!)));
  }

  private selectedReceipts(): VaultReceipt[] {
    const from = document.querySelector<HTMLInputElement>('#from-date')?.value ?? '';
    const to = document.querySelector<HTMLInputElement>('#to-date')?.value ?? '';
    return this.receipts.filter((receipt) => (!from || receipt.date >= from) && (!to || receipt.date <= to)).sort((a, b) => a.date.localeCompare(b.date));
  }

  private updateExportCount(): void {
    const count = this.selectedReceipts().length;
    document.querySelector('#export-count')!.textContent = `${count} receipt${count === 1 ? '' : 's'} selected`;
    const button = document.querySelector<HTMLButtonElement>('#export-button')!; button.disabled = count === 0;
  }

  private async exportPacket(): Promise<void> {
    const selected = this.selectedReceipts(); if (!selected.length) { this.toast('No receipts fall within that period.', true); return; }
    const button = document.querySelector<HTMLButtonElement>('#export-button')!; button.disabled = true; button.textContent = 'Building packet…';
    const options: PacketOptions = {
      from: document.querySelector<HTMLInputElement>('#from-date')?.value ?? '', to: document.querySelector<HTMLInputElement>('#to-date')?.value ?? '',
      title: this.premium ? (document.querySelector<HTMLInputElement>('#packet-title')?.value.trim() || 'Receipt evidence packet') : 'Receipt evidence packet',
      preparedBy: this.premium ? (document.querySelector<HTMLInputElement>('#prepared-by')?.value.trim() ?? '') : '',
    };
    try {
      const packet = await createPacket(selected, options);
      download(packet, `receipt-packet-${options.from || 'all'}-${options.to || isoToday()}.zip`);
      this.toast(`Packet built with ${selected.length} linked original${selected.length === 1 ? '' : 's'}.`);
    } catch { this.toast('The packet could not be built. Try a shorter period or free device memory.', true); }
    finally { button.disabled = false; button.textContent = 'Export evidence ZIP'; }
  }

  private async downloadBackup(): Promise<void> {
    try { download(new Blob([await exportBackup(this.db)], { type: 'application/json' }), `receipt-packet-encrypted-${isoToday()}.json`); this.toast('Encrypted backup downloaded.'); }
    catch { this.toast('The encrypted backup could not be created.', true); }
  }

  private async restoreInWorkspace(input: HTMLInputElement): Promise<void> {
    const file = input.files?.[0]; if (!file) return;
    if (!confirm('Replace every receipt in this vault with the selected encrypted backup?')) { input.value = ''; return; }
    try { await importBackup(this.db, await file.text()); this.key = null; this.receipts = []; this.renderLocked(true); this.toast('Backup restored. Unlock it with its passphrase.'); }
    catch (error) { this.toast(error instanceof Error ? error.message : 'The backup could not be restored.', true); }
  }

  private async submitLicense(event: SubmitEvent): Promise<void> {
    event.preventDefault();
    const token = document.querySelector<HTMLInputElement>('#license-token')!.value.trim();
    const status = document.querySelector<HTMLElement>('#license-status')!;
    if (!token) return;
    saveLicense(token); status.textContent = 'Verifying…';
    const valid = await verifyLicense(token);
    if (valid) { this.license = token; this.premium = true; this.renderWorkspace(); this.toast('Supporter unlock restored.'); }
    else status.textContent = valid === false ? 'That license is not active. Check the token or buy a new unlock.' : 'Could not reach license verification. Your free tools remain available.';
  }

  private async reconcileLicense(token: string): Promise<void> {
    const valid = await verifyLicense(token);
    if (valid !== null && valid !== this.premium) { this.premium = valid; if (this.key) this.renderWorkspace(); if (!valid) this.toast('License no longer active. Core packet tools remain available.', true); }
  }

  private bindGlobalEvents(): void {
    addEventListener('online', () => { this.online = true; this.updateNetwork(); });
    addEventListener('offline', () => { this.online = false; this.updateNetwork(); });
    addEventListener('beforeinstallprompt', (event) => { event.preventDefault(); this.installPrompt = event; const button = document.querySelector<HTMLButtonElement>('#install-button'); if (button) button.hidden = false; });
  }

  private updateNetwork(): void {
    const strip = document.querySelector<HTMLElement>('#network-strip'); if (!strip) return;
    strip.classList.toggle('is-online', this.online); strip.textContent = this.online ? 'Ready offline — your vault stays on this device' : 'Offline — capture and export still work';
  }

  private promptInstall(): void {
    const prompt = this.installPrompt as Event & { prompt?: () => Promise<void> };
    void prompt.prompt?.(); this.installPrompt = null;
    const button = document.querySelector<HTMLButtonElement>('#install-button'); if (button) button.hidden = true;
  }

  private registerServiceWorker(): void {
    if (!('serviceWorker' in navigator)) return;
    const hadController = Boolean(navigator.serviceWorker.controller);
    const register = () => {
      void navigator.serviceWorker.register('/sw.js').then(async () => {
        await navigator.serviceWorker.ready;
        navigator.serviceWorker.addEventListener('controllerchange', () => {
          if (!hadController) return;
          const toast = document.querySelector<HTMLElement>('#toast');
          if (toast) { toast.hidden = false; toast.innerHTML = 'Updated app ready. <button type="button" id="reload-app">Reload</button>'; document.querySelector('#reload-app')?.addEventListener('click', () => location.reload()); }
        });
      }).catch(() => { /* The app remains usable when SW registration is blocked. */ });
    };
    if (document.readyState === 'complete') register();
    else addEventListener('load', register, { once: true });
  }

  private releaseUrls(): void { this.objectUrls.forEach((url) => URL.revokeObjectURL(url)); this.objectUrls = []; }
  private toast(message: string, error = false): void {
    const toast = document.querySelector<HTMLElement>('#toast'); if (!toast) return;
    toast.textContent = message; toast.classList.toggle('error', error); toast.hidden = false;
    setTimeout(() => { toast.hidden = true; }, 5_000);
    const announcer = document.querySelector<HTMLElement>('#announcer'); if (announcer) announcer.textContent = message;
  }

  private renderFatal(error: unknown): void {
    this.root.innerHTML = this.shell(`<main id="main" class="fatal-state"><p class="eyebrow">Storage error</p><h1>The local vault could not open.</h1><p>${escapeHtml(error instanceof Error ? error.message : 'This browser did not make local storage available.')}</p><p>Try a normal browsing window with site storage enabled, then reload.</p><button class="button primary" type="button" onclick="location.reload()">Reload app</button></main>`);
  }
}

void new ReceiptApp().init();
