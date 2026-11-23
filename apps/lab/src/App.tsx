import { Lab } from '@weasel-js/labkit';
import { fiddyInstrument } from './instrument';

const INSTRUMENTS = [fiddyInstrument];

export function App() {
  return <Lab instruments={INSTRUMENTS} title="fiddy" mode="dark" addTrial={false} zoom={false} menuBar={false} />;
}
