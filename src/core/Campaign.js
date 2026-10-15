export const SAVE_KEY = "mars-sweet-heist-campaign-v2";
const blank = () => ({
  version: 2,
  unlocked: 0,
  records: [null, null, null, null],
  checkpoint: null,
});
export class Campaign {
  constructor(storage) {
    this.storage = storage;
    this.data = blank();
    this.available = true;
    try {
      this.storage = storage ?? globalThis.localStorage;
      const saved = JSON.parse(this.storage.getItem(SAVE_KEY));
      if (
        saved?.version === 2 &&
        Number.isInteger(saved.unlocked) &&
        saved.unlocked >= 0 &&
        saved.unlocked <= 3 &&
        Array.isArray(saved.records) &&
        saved.records.length === 4
      )
        this.data = saved;
    } catch {
      this.available = false;
    }
  }
  save() {
    try {
      this.storage.setItem(SAVE_KEY, JSON.stringify(this.data));
      return true;
    } catch {
      this.available = false;
      return false;
    }
  }
  reset() {
    this.data = blank();
    this.save();
  }
  complete(index, result) {
    const previous = this.data.records[index];
    if (!previous || result.score > previous.score)
      this.data.records[index] = result;
    this.data.unlocked = Math.max(this.data.unlocked, Math.min(3, index + 1));
    this.data.checkpoint = null;
    this.save();
  }
  get totals() {
    return this.data.records.reduce(
      (a, r) => ({
        score: a.score + (r?.score || 0),
        sweets: a.sweets + (r?.sweets || 0),
        time: a.time + (r?.time || 0),
      }),
      { score: 0, sweets: 0, time: 0 },
    );
  }
}
