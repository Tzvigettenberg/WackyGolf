// TitleScreen — Phase 3.7
//
// Pure UI — show/hide the title overlay and route button taps to callbacks
// the host wires up. The 3D scene + showcase camera orbit are handled in
// main.js; the title screen itself just darkens the corners and shows
// buttons. Visible on first load and whenever the player taps Pause.

export class TitleScreen {
  constructor({ onPlay, onResume, onCollection }) {
    this.modal = document.getElementById('title-screen');
    this.playBtn = document.getElementById('title-play');
    this.resumeBtn = document.getElementById('title-resume');
    this.collectionBtn = document.getElementById('title-collection');
    this.subtitleEl = document.getElementById('title-subtitle');

    this.playBtn.addEventListener('click', () => onPlay && onPlay());
    this.resumeBtn.addEventListener('click', () => onResume && onResume());
    this.collectionBtn.addEventListener('click', () => onCollection && onCollection());
  }

  show({ canResume = false, holeName = '' } = {}) {
    this.resumeBtn.style.display = canResume ? '' : 'none';
    this.playBtn.textContent = canResume ? 'New Run' : 'Play';
    if (this.subtitleEl) {
      this.subtitleEl.textContent = holeName ? `Now showing · ${holeName.toUpperCase()}` : '';
    }
    this.modal.classList.add('shown');
    document.body.classList.add('title-active');
  }

  hide() {
    // Only hide the modal — main.js owns the body.title-active flag, so the
    // HUD stays hidden while the player browses Collection / hole details.
    this.modal.classList.remove('shown');
  }

  setHoleName(name) {
    if (this.subtitleEl) {
      this.subtitleEl.textContent = name ? `Now showing · ${name.toUpperCase()}` : '';
    }
  }
}
