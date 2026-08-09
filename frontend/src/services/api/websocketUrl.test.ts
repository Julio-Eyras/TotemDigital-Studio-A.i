import { getWebSocketHost, getWebSocketUrl } from './index';

describe('URL do WebSocket', () => {
  const previousApiUrl = process.env.REACT_APP_API_URL;

  afterEach(() => {
    if (previousApiUrl === undefined) {
      delete process.env.REACT_APP_API_URL;
    } else {
      process.env.REACT_APP_API_URL = previousApiUrl;
    }
  });

  it('remove o caminho /api da URL absoluta do backend', () => {
    process.env.REACT_APP_API_URL = 'https://totemdigital.app.br/api';

    expect(getWebSocketHost()).toBe('totemdigital.app.br');
    expect(getWebSocketUrl('token teste')).toBe(
      'wss://totemdigital.app.br/ws?token=token%20teste',
    );
  });

  it('preserva porta e escolhe ws para backend HTTP', () => {
    process.env.REACT_APP_API_URL = 'http://localhost:3000/api/';

    expect(getWebSocketHost()).toBe('localhost:3000');
    expect(getWebSocketUrl('abc')).toBe('ws://localhost:3000/ws?token=abc');
  });
});
