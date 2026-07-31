/**
 * MapManager.js
 * 지역별 맵 설정 관리, 지역 전환 이벤트 발행
 * @module @core/MapManager
 */
import { CoordinateMapper } from './CoordinateMapper.js';
import { Calibration } from './Calibration.js';
import { MapAssetLoader } from './MapAssetLoader.js';

export class MapManager extends EventTarget {
  /**
   * @param {object[]} regionsData - regions.json에서 로드된 지역 배열
   * @param {object} [options]
   * @param {MapAssetLoader} [options.loader]
   */
  constructor(regionsData, options = {}) {
    super();
    /** @type {Map<string, object>} */
    this._regions = new Map(regionsData.map(r => [r.name, r]));
    this._loader = options.loader || new MapAssetLoader(options.loaderOptions);
    this._currentRegion = null;
    this._currentHuntingGround = null;
    this._mapper = null;
    this._calibration = null;
  }

  /**
   * URL(예: /regions.json)을 통한 비동기 MapManager 인스턴스 생성 팩토리
   * @param {string} [url='/regions.json']
   * @param {object} [options]
   * @returns {Promise<MapManager>}
   */
  static async loadFromUrl(url = '/regions.json', options = {}) {
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`Failed to fetch regions from ${url}: ${res.status}`);
    }
    const data = await res.json();
    return new MapManager(data, options);
  }

  /**
   * 지역 목록 반환
   * @returns {string[]}
   */
  get regionNames() {
    return [...this._regions.keys()];
  }

  getRegionNames() {
    return [...this._regions.keys()];
  }

  get regions() {
    return Array.from(this._regions.values());
  }

  getRegions() {
    return Array.from(this._regions.values());
  }

  getHuntingGrounds(regionId) {
    if (regionId !== undefined && regionId !== null) {
      const region = this._regions.get(regionId) || Array.from(this._regions.values()).find(r => r.id === regionId || r.name === regionId);
      return region && region.huntingGrounds ? region.huntingGrounds : [];
    }
    return this._currentRegion && this._currentRegion.huntingGrounds ? this._currentRegion.huntingGrounds : [];
  }

  get huntingGrounds() {
    return this.getHuntingGrounds();
  }

  get currentRegion() { return this._currentRegion; }
  get currentHuntingGround() { return this._currentHuntingGround; }
  get mapper() { return this._mapper; }
  get calibration() { return this._calibration; }
  get loader() { return this._loader; }

  /**
   * 지역 설정 전환
   * @param {string} regionName
   * @fires MapManager#regionChanged
   */
  setRegion(regionName) {
    const region = this._regions.get(regionName);
    if (!region) {
      console.warn(`[MapManager] 알 수 없는 지역: "${regionName}"`);
      return;
    }
    this._currentRegion = region;
    this._currentHuntingGround = null;
    this._mapper = null; // 사냥터 지정 후 갱신
    this._calibration = new Calibration(regionName);

    // 해당 지역 내 사냥터 이미지 백그라운드 사전 로딩
    if (region.huntingGrounds && Array.isArray(region.huntingGrounds)) {
      this._loader.preloadHuntingGrounds(region.huntingGrounds);
    }

    this.dispatchEvent(new CustomEvent('regionChanged', { detail: { region } }));
    console.debug('[MapManager] 지역 전환:', regionName);
  }

  /**
   * 사냥터 설정 — 해당 맵의 CoordinateMapper 생성
   * @param {object} huntingGround - regions.json의 huntingGrounds 항목
   */
  setHuntingGround(huntingGround) {
    // 별칭 처리 (Opus 검토 결과)
    huntingGround.backgroundImageUrl = huntingGround.backgroundImageUrl || huntingGround.mapImg;
    huntingGround.hitboxDataUrl = huntingGround.hitboxDataUrl || huntingGround.hitboxImg || (huntingGround.mapImg ? huntingGround.mapImg.replace('/images/', '/Hitbox/') : null);

    this._currentHuntingGround = huntingGround;

    // 사냥터의 실제 치수로 매퍼 생성
    // screenWidth/Height는 렌더러가 동적으로 알려줌 → 나중에 updateScreenSize로 갱신
    this._mapper = new CoordinateMapper({
      worldWidth: huntingGround.realW || 2000,
      worldHeight: huntingGround.realH || 1500,
      screenWidth: 800,  // 기본값, updateScreenSize로 갱신
      screenHeight: 600,
      clamp: true,
    });

    this.dispatchEvent(new CustomEvent('huntingGroundChanged', { detail: { huntingGround } }));
    console.debug('[MapManager] 사냥터 설정:', huntingGround.name);
  }

  /**
   * Canvas 크기 변경 시 매퍼 화면 크기 갱신
   * @param {number} w
   * @param {number} h
   */
  updateScreenSize(w, h) {
    if (this._mapper) {
      this._mapper.screenWidth = w;
      this._mapper.screenHeight = h;
    }
  }

  /**
   * 지역명으로 지역 데이터 조회
   * @param {string} name
   */
  getRegion(name) {
    return this._regions.get(name);
  }
}
