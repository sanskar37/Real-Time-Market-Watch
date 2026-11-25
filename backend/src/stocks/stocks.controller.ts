import { Controller, Get, Header } from '@nestjs/common';
import { MarketSimulatorService } from '../market/market-simulator.service';
import type { StockInfo } from '../market/market.types';
import { DEFAULT_SYMBOLS } from '../market/stock-catalog';

export interface StockCatalogResponse {
  /** Every stock a user can pick. */
  stocks: readonly StockInfo[];
  /** The symbols the screen preselects. */
  defaults: readonly string[];
}

@Controller('api')
export class StocksController {
  constructor(private readonly simulator: MarketSimulatorService) {}

  /** The picker list. It never changes while the server runs, so clients may cache it. */
  @Get('stocks')
  @Header('Cache-Control', 'public, max-age=60')
  stocks(): StockCatalogResponse {
    const all = this.simulator.stocks();
    return { stocks: all, defaults: DEFAULT_SYMBOLS.filter((s) => this.simulator.has(s)) };
  }
}
