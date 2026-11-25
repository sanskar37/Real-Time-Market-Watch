import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { StockSelect } from './StockSelect';

const STOCKS = [
  { symbol: 'RELIANCE', company: 'Reliance Industries' },
  { symbol: 'TCS', company: 'Tata Consultancy Services' },
  { symbol: 'HDFCBANK', company: 'HDFC Bank' },
  { symbol: 'INFY', company: 'Infosys' },
  { symbol: 'ITC', company: 'ITC Limited' },
];

beforeAll(() => {
  // jsdom has no layout: answer every media query as a wide desktop.
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: query.includes('min-width'),
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  }));
  Element.prototype.scrollIntoView = () => {};
});

function Harness({ initial }: { initial: string[] }) {
  const [selected, setSelected] = useState(initial);
  const toggle = (s: string) =>
    setSelected((cur) => (cur.includes(s) ? cur.filter((x) => x !== s) : [...cur, s]));
  return (
    <>
      <span id="label">Select Stocks</span>
      <StockSelect stocks={STOCKS} selected={selected} onToggle={toggle} labelledBy="label" />
      <output data-testid="selected">{selected.join(',')}</output>
    </>
  );
}

describe('StockSelect', () => {
  it('shows three chips and collapses the rest into +N, like the reference', () => {
    render(<Harness initial={['RELIANCE', 'TCS', 'HDFCBANK', 'INFY', 'ITC']} />);
    expect(screen.getByText('RELIANCE')).toBeInTheDocument();
    expect(screen.getByText('HDFCBANK')).toBeInTheDocument();
    expect(screen.queryByText('INFY')).not.toBeInTheDocument();
    expect(screen.getByText('+2')).toBeInTheDocument();
  });

  it('removes a stock from its chip', () => {
    render(<Harness initial={['RELIANCE', 'TCS']} />);
    fireEvent.click(screen.getByRole('button', { name: 'Remove TCS' }));
    expect(screen.getByTestId('selected')).toHaveTextContent(/^RELIANCE$/);
  });

  it('adds and removes stocks from the list with mouse and keyboard', () => {
    render(<Harness initial={['RELIANCE']} />);
    fireEvent.click(screen.getByRole('button', { name: 'Select Stocks' }));
    const list = screen.getByRole('listbox');

    fireEvent.click(screen.getByRole('option', { name: /INFY/ }));
    expect(screen.getByTestId('selected')).toHaveTextContent('RELIANCE,INFY');

    fireEvent.keyDown(list, { key: 'ArrowDown' }); // TCS
    fireEvent.keyDown(list, { key: 'Enter' });
    expect(screen.getByTestId('selected')).toHaveTextContent('RELIANCE,INFY,TCS');

    fireEvent.keyDown(list, { key: 'Escape' });
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('marks chosen options as selected for assistive tech', () => {
    render(<Harness initial={['TCS']} />);
    fireEvent.click(screen.getByRole('button', { name: 'Select Stocks' }));
    expect(screen.getByRole('option', { name: /TCS/ })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('option', { name: /ITC/ })).toHaveAttribute('aria-selected', 'false');
  });
});
