import { get, RequestCallback } from 'request';

interface FixerBody {
  success: boolean;
  base: string;
  rates: {[currency: string]: number};
}

export interface ConvertData {
  value: number;
  from: string;
  to: string;
}

export class Converter {
  private readonly realTimeCurrencyUrl = 'http://data.fixer.io/api/latest?access_key=5b84246bf4897159cfa64baa7eab657d&format=1';
  private currencies: {[currency: string]: number};
  private initialized: boolean = false;

  constructor() { }

  public init(): Promise<void> {
    return new Promise((resolve, reject) => {
      get(this.realTimeCurrencyUrl, { json: true }, (error, response, body) => {
        if (error || !body.success) return reject();
        this.initialized = true;
        this.currencies = body.rates;
        resolve();
      });
    });
  }

  public convert(data: ConvertData): Promise<number> {
    return new Promise(async (resolve, reject) => {
      try {
        if (data.from === data.to) return resolve(data.value);
        if (!this.initialized) await this.init();
        resolve(this.getRate(data) * data.value);
      }
      catch (error) { reject(error && error.message ? error : { message: 'Cannot convert data' }); }
    });
  }

  private getRate(data: {from: string, to: string}): number {
    if (data.from === 'EUR') return this.currencies[data.to];
    if (data.to === 'EUR') return 1 / this.currencies.EUR;
    return this.getRate({ from: data.from, to: 'EUR' }) * this.getRate({ from: 'EUR', to: data.to });
  }
}
