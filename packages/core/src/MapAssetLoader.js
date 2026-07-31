/**
 * MapAssetLoader.js
 * LRU 메모리 캐싱, 프로미스 중복 방지, 비동기 맵 에셋 로딩 클래스
 * @module @mp1/core/MapAssetLoader
 */

export class MapAssetLoader {
  /**
   * @param {object} [options]
   * @param {number} [options.maxCacheSize=50] - LRU 캐시 용량 제한
   * @param {() => any} [options.imageFactory] - 이미지 객체 생성 팩토리 (테스트 주입용)
   * @param {string} [options.baseUrl=''] - 상대 경로 결합용 기본 URL
   */
  constructor(options = {}) {
    this._maxCacheSize = options.maxCacheSize || 50;
    this._imageFactory = options.imageFactory || (() => (typeof Image !== 'undefined' ? new Image() : {}));
    this._baseUrl = options.baseUrl || '';

    /** @type {Map<string, any>} LRU 캐시 (URL -> Image) */
    this._cache = new Map();
    /** @type {Map<string, Promise<any>>} 진행 중인 비동기 로드 프로미스 (Deduplication) */
    this._pending = new Map();
  }

  get maxCacheSize() { return this._maxCacheSize; }
  get cacheSize() { return this._cache.size; }
  get pendingCount() { return this._pending.size; }

  /**
   * 상대 경로 정규화 (./images/... -> images/...)
   * @param {string} rawUrl
   * @returns {string}
   */
  normalizeUrl(rawUrl) {
    if (!rawUrl) return '';
    let cleaned = rawUrl.replace(/^\.\//, '');
    if (this._baseUrl && !cleaned.startsWith('http') && !cleaned.startsWith('/') && !cleaned.startsWith('data:')) {
      cleaned = `${this._baseUrl.replace(/\/$/, '')}/${cleaned}`;
    }
    return cleaned;
  }

  /**
   * 단일 이미지 비동기 로딩 (동일 URL 디두플리케이션을 위해 원본 프로미스 반환)
   * @param {string} rawUrl
   * @returns {Promise<any>}
   */
  loadImage(rawUrl) {
    const url = this.normalizeUrl(rawUrl);
    if (!url) {
      return Promise.reject(new Error('Invalid image URL'));
    }

    // 1. LRU 캐시 히트 시 순서 갱신 후 반환
    if (this._cache.has(url)) {
      const img = this._cache.get(url);
      this._cache.delete(url);
      this._cache.set(url, img);
      return Promise.resolve(img);
    }

    // 2. 이미 로딩 중인 프로미스가 있는 경우 동일 프로미스 반환 (Deduplication)
    if (this._pending.has(url)) {
      return this._pending.get(url);
    }

    // 3. 신규 로딩 프로미스 생성
    const promise = new Promise((resolve, reject) => {
      let img;
      try {
        img = this._imageFactory();
      } catch (err) {
        this._pending.delete(url);
        return reject(err);
      }

      const cleanup = () => {
        this._pending.delete(url);
      };

      img.onload = () => {
        cleanup();
        // LRU 용량 초과 시 가장 오래된 요소 제거
        if (this._cache.size >= this._maxCacheSize) {
          const oldestKey = this._cache.keys().next().value;
          if (oldestKey !== undefined) {
            this._cache.delete(oldestKey);
          }
        }
        this._cache.set(url, img);
        resolve(img);
      };

      img.onerror = (err) => {
        cleanup();
        const error = err instanceof Error ? err : new Error(`Failed to load image: ${url}`);
        error.url = url;
        reject(error);
      };

      // src 설정하여 이미지 다운로드 시작
      img.src = url;
    });

    this._pending.set(url, promise);
    return promise;
  }

  /**
   * 사냥터 객체 배경 및 히트박스 이미지 로드
   * @param {object} hg
   * @returns {Promise<{ bgImage: any, hitboxImage: any, errors: Error[] }>}
   */
  async loadMapAssets(hg) {
    if (!hg) {
      return { bgImage: null, hitboxImage: null, errors: [new Error('No hunting ground provided')] };
    }

    const bgUrl = hg.backgroundImageUrl || hg.mapImg;
    const hbUrl = hg.hitboxDataUrl || hg.hitboxImg;

    const results = await Promise.allSettled([
      bgUrl ? this.loadImage(bgUrl) : Promise.resolve(null),
      hbUrl ? this.loadImage(hbUrl) : Promise.resolve(null),
    ]);

    const bgResult = results[0];
    const hbResult = results[1];
    const errors = [];

    if (bgResult.status === 'rejected') errors.push(bgResult.reason);
    if (hbResult.status === 'rejected') errors.push(hbResult.reason);

    return {
      bgImage: bgResult.status === 'fulfilled' ? bgResult.value : null,
      hitboxImage: hbResult.status === 'fulfilled' ? hbResult.value : null,
      errors,
    };
  }

  /**
   * 사냥터 리스트 사전 로딩 (비차단)
   * @param {object[]} huntingGrounds
   */
  preloadHuntingGrounds(huntingGrounds = []) {
    if (!Array.isArray(huntingGrounds)) return;
    for (const hg of huntingGrounds) {
      if (!hg) continue;
      const bgUrl = hg.backgroundImageUrl || hg.mapImg;
      const hbUrl = hg.hitboxDataUrl || hg.hitboxImg;
      if (bgUrl && !this.has(bgUrl)) {
        this.loadImage(bgUrl).catch(() => {});
      }
      if (hbUrl && !this.has(hbUrl)) {
        this.loadImage(hbUrl).catch(() => {});
      }
    }
  }

  /**
   * 캐시 포함 여부
   * @param {string} rawUrl
   * @returns {boolean}
   */
  has(rawUrl) {
    const url = this.normalizeUrl(rawUrl);
    return this._cache.has(url);
  }

  /**
   * 캐시 및 대기열 초기화
   */
  clear() {
    this._cache.clear();
    this._pending.clear();
  }
}
