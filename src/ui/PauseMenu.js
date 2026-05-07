// PauseMenu — Phase 3.7
//
// Lightweight in-game pause overlay. Just two buttons:
//   - Resume: continue from where you left off
//   - Quit:   abandon the run and return to the title screen
//
// Distinct from the TitleScreen — that's the boot/home view. The PauseMenu
// only ever appears mid-run, sized as a small centered card.

export class PauseMenu {
  constructor({ onResume, onQuit }) {
    this.modal = document.getElementById('pause-menu');
    this.resumeBtn = document.getElementById('pause-resume');
    this.quitBtn = document.getElementById('pause-quit');

    this.resumeBtn.addEventListener('click', () => onResume && onResume());
    this.quitBtn.addEventListener('click', () => onQuit && onQuit());
    // backdrop click also resumes
    this.modal.addEventListener('click', (e) => {
      if (e.target === this.modal) onResume && onResume();
    });
  }

  show() { this.modal.classList.add('shown'); }
  hide() { this.modal.classList.remove('shown'); }
}
