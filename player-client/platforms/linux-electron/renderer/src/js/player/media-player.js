/**
 * Media Player - Linux Electron
 * Player de mídia (reutiliza código do webOS)
 */

class MediaPlayer {
  constructor(container) {
    this.container = container;
    this.currentItem = null;
    this.currentElement = null;
    this.onEndCallback = null;
  }

  /**
   * Reproduz item de mídia
   */
  async play(item) {
    this.stop();

    this.currentItem = item;

    switch (item.type) {
      case 'video':
        await this.playVideo(item);
        break;
      case 'image':
        await this.playImage(item);
        break;
      case 'html':
        await this.playHTML(item);
        break;
      default:
        throw new Error(`Unsupported media type: ${item.type}`);
    }
  }

  /**
   * Reproduz vídeo
   */
  async playVideo(item) {
    if (this.currentElement) {
      this.currentElement.remove();
    }

    const video = document.createElement('video');
    video.src = item.url;
    video.autoplay = true;
    video.muted = false;
    video.controls = false;
    video.style.width = '100%';
    video.style.height = '100%';
    video.style.objectFit = 'contain';
    video.style.transition = 'opacity 0.5s ease-in-out';
    video.style.opacity = '0';

    video.addEventListener('loadeddata', () => {
      video.style.opacity = '1';
    });

    video.addEventListener('ended', () => {
      video.style.opacity = '0';
      setTimeout(() => {
        this.onMediaEnd();
      }, 500);
    });

    video.addEventListener('error', (e) => {
      console.error('Video playback error:', e);
      this.onMediaEnd();
    });

    this.container.appendChild(video);
    this.currentElement = video;

    try {
      await video.play();
    } catch (error) {
      console.error('Failed to play video:', error);
      this.onMediaEnd();
    }
  }

  /**
   * Reproduz imagem
   */
  async playImage(item) {
    if (this.currentElement) {
      this.currentElement.remove();
    }

    const img = document.createElement('img');
    img.src = item.url;
    img.style.width = '100%';
    img.style.height = '100%';
    img.style.objectFit = 'contain';
    img.style.transition = 'opacity 0.5s ease-in-out';
    img.style.opacity = '0';

    img.addEventListener('load', () => {
      img.style.opacity = '1';
    });

    img.addEventListener('error', () => {
      console.error('Image load error');
      this.onMediaEnd();
    });

    const duration = item.duration || 10000;

    this.container.appendChild(img);
    this.currentElement = img;

    setTimeout(() => {
      img.style.opacity = '0';
      setTimeout(() => {
        this.onMediaEnd();
      }, 500);
    }, duration);
  }

  /**
   * Reproduz HTML/Web
   */
  async playHTML(item) {
    if (this.currentElement) {
      this.currentElement.remove();
    }

    const iframe = document.createElement('iframe');
    iframe.src = item.url;
    iframe.style.width = '100%';
    iframe.style.height = '100%';
    iframe.style.border = 'none';
    iframe.style.transition = 'opacity 0.5s ease-in-out';
    iframe.style.opacity = '0';

    iframe.addEventListener('load', () => {
      iframe.style.opacity = '1';
    });

    iframe.addEventListener('error', () => {
      console.error('Iframe load error');
      this.onMediaEnd();
    });

    const duration = item.duration || 30000;

    this.container.appendChild(iframe);
    this.currentElement = iframe;

    setTimeout(() => {
      iframe.style.opacity = '0';
      setTimeout(() => {
        this.onMediaEnd();
      }, 500);
    }, duration);
  }

  /**
   * Para reprodução
   */
  stop() {
    if (this.currentElement) {
      if (this.currentElement.tagName === 'VIDEO') {
        this.currentElement.pause();
        this.currentElement.src = '';
      }
      this.currentElement.remove();
      this.currentElement = null;
    }
    this.currentItem = null;
  }

  /**
   * Callback quando mídia termina
   */
  onMediaEnd() {
    this.stop();
    if (this.onEndCallback) {
      this.onEndCallback();
    }
  }

  /**
   * Define callback para quando mídia termina
   */
  onEnd(callback) {
    this.onEndCallback = callback;
  }
}

// Exportar
if (typeof module !== 'undefined' && module.exports) {
  module.exports = MediaPlayer;
} else {
  window.MediaPlayer = MediaPlayer;
}

