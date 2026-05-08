// PauseMenu — Phase 3.7
//
// Lightweight in-game pause overlay:
//   - Resume: continue from where you left off
//   - Quit:   abandon the run and return to the title screen
//   - Mute:   toggle game audio (state persisted in localStorage)
//
// Distinct from the TitleScreen — that's the boot/home view. The PauseMenu
// only ever appears mid-run (or from the shop / preview), sized as a small
// centered card.

import { sfx } from '../audio/Sfx.js';

export class PauseMenu {
  constructor({ onResume, onQuit }) {
    this.modal = document.getElementById('pause-menu');
    this.resumeBtn = document.getElementById('pause-resume');
    this.quitBtn = document.getElementById('pause-quit');
    this.muteBtn = document.getElementById('pause-mute');

    this.resumeBtn.addEventListener('click', () => {
      sfx.uiClick();
      onResume && onResume();
    });
    this.quitBtn.addEventListener('click', () => {
      sfx.uiClick();
      onQuit && onQuit();
    });
    if (this.muteBtn) {
      this.muteBtn.addEventListener('click', () => {
        sfx.setMuted(!sfx.isMuted());
        this._refreshMuteLabel();
        // Tick AFTER toggle so unmuting plays a sound, muting goes silent.
        sfx.uiClick();
      });
    }
    // backdrop click also resumes
    this.modal.addEventListener('click', (e) => {
      if (e.target === this.modal) onResume && onResume();
    });
  }

  show() {
    this._refreshMuteLabel();
    this.modal.classList.add('shown');
  }
  hide() { this.modal.classList.remove('shown'); }

  _refreshMuteLabel() {
    if (!this.muteBtn) return;
    const muted = sfx.isMuted();
    this.muteBtn.innerHTML = muted
      ? '<i class="fa-solid fa-volume-xmark"></i>&nbsp;&nbsp;Sound Off'
      : '<i class="fa-solid fa-volume-high"></i>&nbsp;&nbsp;Sound On';
    this.muteBtn.classList.toggle('muted', muted);
  }
}
