// Shop — Phase 4a
//
// Pro Shop modal that opens after the cash-out screen. v1 only has the
// Stats tab populated; Clubs and Items tabs are scaffolded but disabled
// until later phases bring them online.

const STATS_META = [
  { id: 'power',    name: 'Power',    desc: '+5% distance per level' },
  { id: 'accuracy', name: 'Accuracy', desc: 'Wider tempo Good zone (coming soon)' },
  { id: 'touch',    name: 'Touch',    desc: 'Wider tempo Perfect zone (coming soon)' },
  { id: 'luck',     name: 'Luck',     desc: 'Better shop rolls + kinder bounces (coming soon)' },
];

export class Shop {
  constructor({ run, onContinue }) {
    this.run = run;
    this.onContinue = onContinue || null;

    this.modal = document.getElementById('shop');
    this.cashEl = this.modal.querySelector('.shop-cash');
    this.continueBtn = this.modal.querySelector('.shop-continue');
    this.statsTabEl = this.modal.querySelector('.stats-tab');
    this.titleEl = this.modal.querySelector('.shop-title');

    this.continueBtn.addEventListener('click', () => {
      this.hide();
      if (this.onContinue) this.onContinue();
    });

    this._buildStatsTab();

    // Refresh whenever the run changes (cash decreases on upgrade,
    // stat level increases, etc.).
    run.onChange(() => {
      if (this.modal.classList.contains('shown')) this._refresh();
    });
  }

  show({ holeName, holeNumber } = {}) {
    if (this.titleEl) {
      const sub = holeName ? ` · After ${holeName}` : '';
      this.titleEl.textContent = `Pro Shop${sub}`;
    }
    this._refresh();
    this.modal.classList.add('shown');
  }

  hide() {
    this.modal.classList.remove('shown');
  }

  // ----- internals -----

  _buildStatsTab() {
    this.statsTabEl.innerHTML = '';
    for (const meta of STATS_META) {
      const row = document.createElement('div');
      row.className = 'stat-row';
      row.dataset.stat = meta.id;
      row.innerHTML = `
        <div class="stat-info">
          <div class="stat-name">${meta.name}</div>
          <div class="stat-desc">${meta.desc}</div>
        </div>
        <div class="stat-meta">
          <div class="stat-level">Lvl 1/10</div>
          <button class="upgrade-btn" type="button">$0</button>
        </div>
      `;
      const btn = row.querySelector('.upgrade-btn');
      btn.addEventListener('click', () => {
        if (this.run.upgradeStat(meta.id)) {
          // brief visual punch
          row.classList.add('just-upgraded');
          setTimeout(() => row.classList.remove('just-upgraded'), 350);
        }
      });
      this.statsTabEl.appendChild(row);
    }
  }

  _refresh() {
    this.cashEl.textContent = `$${this.run.cash}`;

    const rows = this.modal.querySelectorAll('.stats-tab .stat-row');
    for (const row of rows) {
      const id = row.dataset.stat;
      const lvl = this.run.stats[id];
      const max = this.run.statMax(id);
      const cost = this.run.statUpgradeCost(id);
      const canUpgrade = this.run.canUpgrade(id);
      const canAfford = this.run.cash >= cost;

      const lvlEl = row.querySelector('.stat-level');
      lvlEl.textContent = `Lvl ${lvl}/${max}`;

      const btn = row.querySelector('.upgrade-btn');
      if (!canUpgrade) {
        btn.textContent = 'MAX';
        btn.disabled = true;
        btn.classList.add('maxed');
      } else {
        btn.textContent = `$${cost}`;
        btn.disabled = !canAfford;
        btn.classList.remove('maxed');
        btn.classList.toggle('cant-afford', !canAfford);
      }
    }
  }
}
