import { expect } from 'chai';
import { verifyIAPHeader } from '../src/security/iap-check';
import * as sinon from 'sinon';
import { IAPVerifiedRequest } from '../src/interface/restify';
import * as Restify from 'restify';
import fetch from 'node-fetch';
import * as jwt from 'jsonwebtoken';

const reqMock = {
  log: { info: () => {} },
  connection: { remoteAddress: '' },
  headers: {}
} as unknown as IAPVerifiedRequest;

const iapVerifyHeaders = {
    '5PuDqQ': '-----BEGIN PUBLIC KEY----- MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAEi18fVvEF4SW1EAHabO7lYAbOtJeT uxXv1IQOSdQE/Hj3ZwvbcvOZ8AfwQ9+DJJmqgOHGhLElh6S4XYKxZrGIhg== -----END PUBLIC KEY----- ',
    '7ZcBOQ': '-----BEGIN PUBLIC KEY----- MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAEzNEADmf1DNskRfw6Vw4t6jVpRZhW DoijmDNIpk0xlMQt7mpsTdKJk7VNVCuEVvuxaKu/c7GL9pLag7I2sDqegQ== -----END PUBLIC KEY----- ',
    'BOIWdQ': '-----BEGIN PUBLIC KEY----- MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAEcqFXSp+TUxZN3uuNFKsz82GwmCs3 y+d4ZBr74btAQt9uqqBjy/KWVa63kh+NGlZfHyfjXc81E42itIVuX3en3w== -----END PUBLIC KEY----- ',
    'ibp09g': '-----BEGIN PUBLIC KEY----- MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAECvHxwrwrHpWMhq8Wx1wgBjx55iOP ppAUxTKhX5cMQvWkN00iJYPD/C+d0NSYBiiUn32E7s49Ne5ttMGMbhnVUA== -----END PUBLIC KEY----- ',
    's3nVXQ': '-----BEGIN PUBLIC KEY----- MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAEUnyNfx2yYjT7IQUQxcV1HhZ/2qKA acAvvQCslOga0hOxWOT7IePQnMbIhtuRsc/FTL1Btuc2xFVHAqJmOtYD3A== -----END PUBLIC KEY----- ',
};

describe('IAP header verification', () => {
  beforeEach(() => {
    // @ts-ignore
    sinon.stub(fetch, 'default').returns(
      Promise.resolve({
        json: () => Promise.resolve(iapVerifyHeaders)
      })
    );

    sinon.stub(jwt, 'decode').returns({
      header: {
        'kid': '5PuDqQ',
        'x-goog-iap-jwt-assertion': iapVerifyHeaders['5PuDqQ'],
      },
      email: 'anotherallowed@nytimes.com'
    });

    sinon.stub(jwt, 'verify').returns({
      email: 'anotherallowed@nytimes.com',
      sub: 'sub',
    });
  });

  afterEach(() => {
    // @ts-ignore
    jwt.decode.restore();
    // @ts-ignore
    jwt.verify.restore();

    // @ts-ignore
    fetch.restore();
  });

  it('should skip if not enabled via env variable', async () => {
    delete process.env.VERIFY_IAP;
    const nextSpy = sinon.spy();

    verifyIAPHeader(
      reqMock,
      {} as Restify.Response,
      nextSpy as unknown as Restify.Next
    );

    const [arg] = nextSpy.getCall(0).args;

    expect(nextSpy.callCount).to.equal(1);
    expect(arg).to.be.an('undefined');
  });

  it('should skip in development / test', async () => {
    process.env.VERIFY_IAP = "true";

    const originalNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';

    const nextSpy = sinon.spy();

    verifyIAPHeader(
      reqMock,
      {} as Restify.Response,
      nextSpy as unknown as Restify.Next
    );

    expect(nextSpy.callCount).to.equal(1);

    process.env.NODE_ENV = 'test';
    nextSpy.resetHistory();
    await verifyIAPHeader(
      reqMock,
      {} as Restify.Response,
      nextSpy as unknown as Restify.Next
    );

    const [arg] = nextSpy.getCall(0).args;

    expect(nextSpy.callCount).to.equal(1);
    expect(arg).to.be.an('undefined');

    delete process.env.VERIFY_IAP;
    process.env.NODE_ENV = originalNodeEnv;
  });

  it('should skip on loopback addresses', async () => {
    process.env.VERIFY_IAP = "true";

    const nextSpy = sinon.spy();

    await verifyIAPHeader(
      { ...reqMock, connection: { remoteAddress: '::1' } } as unknown as IAPVerifiedRequest,
      {} as Restify.Response,
      nextSpy as unknown as Restify.Next
    );

    const [arg] = nextSpy.getCall(0).args;

    expect(nextSpy.callCount).to.equal(1);
    expect(arg).to.be.an('undefined');

    delete process.env.VERIFY_IAP;
  });

  it('should allow requests from allowed addresses', async () => {
    process.env.VERIFY_IAP = "true";
    process.env.IAP_ALLOWLIST = "allowed@nytimes.com,anotherallowed@nytimes.com";

    const nextSpy = sinon.spy();

    await verifyIAPHeader(
      reqMock,
      {} as Restify.Response,
      nextSpy as unknown as Restify.Next
    );

    const [arg] = nextSpy.getCall(0).args;

    expect(nextSpy.callCount).to.equal(1);
    expect(arg).to.be.an('undefined');

    delete process.env.VERIFY_IAP;
    delete process.env.IAP_ALLOWLIST;
  });

  it('should not allow requests from disallowed addresses', async () => {
    process.env.VERIFY_IAP = "true";
    process.env.IAP_ALLOWLIST = "anaddress@nytimes.com,anotheraddress@nytimes.com";

    const nextSpy = sinon.spy();

    await verifyIAPHeader(
      reqMock,
      {} as Restify.Response,
      nextSpy as unknown as Restify.Next
    );

    const [arg] = nextSpy.getCall(0).args;

    expect(nextSpy.callCount).to.equal(1);
    expect(arg instanceof Error).to.be.true;

    delete process.env.VERIFY_IAP;
    delete process.env.IAP_ALLOWLIST;
  });
});