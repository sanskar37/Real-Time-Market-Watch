import { Module } from '@nestjs/common';
import { APP_CONFIG, loadConfig } from '../config/app-config';
import { MarketSimulatorService } from './market-simulator.service';

@Module({
  providers: [{ provide: APP_CONFIG, useFactory: () => loadConfig() }, MarketSimulatorService],
  exports: [APP_CONFIG, MarketSimulatorService],
})
export class MarketModule {}
