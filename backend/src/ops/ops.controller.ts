import { Controller, Get, Header } from '@nestjs/common';
import { MarketGateway } from '../gateway/market.gateway';
import { MarketSimulatorService } from '../market/market-simulator.service';
import { MetricsService } from '../metrics/metrics.service';

const mb = (bytes: number) => Math.round(bytes / 1024 / 1024);

/** Operational endpoints: a liveness check and the numbers behind the scalability demo. */
@Controller('api')
export class OpsController {
  constructor(
    private readonly simulator: MarketSimulatorService,
    private readonly gateway: MarketGateway,
    private readonly metrics: MetricsService,
  ) {}

  @Get('health')
  @Header('Cache-Control', 'no-store')
  health() {
    return {
      status: 'ok',
      connections: this.gateway.connections,
      stocks: this.simulator.stocks().length,
      ticks: this.simulator.ticks,
      simulating: this.simulator.running,
      uptimeSeconds: Math.round(process.uptime()),
      rssMb: mb(process.memoryUsage().rss),
    };
  }

  /** Live load figures; `window` covers the last complete five seconds. */
  @Get('metrics')
  @Header('Cache-Control', 'no-store')
  snapshot() {
    const memory = process.memoryUsage();
    return {
      connections: this.gateway.connections,
      subscriptions: this.gateway.subscriptions,
      stocks: this.simulator.stocks().length,
      uptimeSeconds: Math.round(process.uptime()),
      memoryMb: { rss: mb(memory.rss), heapUsed: mb(memory.heapUsed) },
      totals: { ...this.metrics.totals, slowClientsDropped: this.metrics.slowClientsDropped },
      window: this.metrics.lastWindow(),
    };
  }
}
