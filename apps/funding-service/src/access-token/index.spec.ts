import { AccessTokenService } from ".";
import assert from "assert";
import { DBInstance } from "../types";
import { errors } from "pg-promise";
import { MockPgInstanceSingleton } from "@rpch/common/build/internal/db";
import path from "path";
import * as PgMem from "pg-mem";

const THIRTY_MINUTES_IN_MS = 30 * 60_000;
const MAX_HOPR = BigInt(40);
const SECRET_KEY = "SECRET";
const accessTokenParams = {
  amount: MAX_HOPR,
  timeout: THIRTY_MINUTES_IN_MS,
};
describe("test AccessTokenService class", function () {
  let accessTokenService: AccessTokenService;
  let dbInstance: DBInstance;

  beforeAll(async function () {
    const migrationsDirectory = path.join(__dirname, "../../migrations");
    dbInstance = await MockPgInstanceSingleton.getDbInstance(
      PgMem,
      migrationsDirectory
    );
    MockPgInstanceSingleton.getInitialState();
  });

  beforeEach(function () {
    MockPgInstanceSingleton.getInitialState().restore();
    accessTokenService = new AccessTokenService(dbInstance, SECRET_KEY);
  });

  it("should create and save token", async function () {
    const accessToken = await accessTokenService.createAccessToken(
      accessTokenParams
    );
    const dbAccessToken = await accessTokenService.getAccessToken(
      accessToken?.token!
    );
    assert(dbAccessToken?.token === accessToken?.token);
  });
  it("should create access token that expires in a specific amount of milliseconds", async function () {
    const expectedExpireDate = new Date(
      new Date().valueOf() + THIRTY_MINUTES_IN_MS
    );
    const accessToken = await accessTokenService.createAccessToken(
      accessTokenParams
    );
    const dbAccessToken = await accessTokenService.getAccessToken(
      accessToken?.token!
    );

    // the diff between what is expected and reality is less than 1 second
    expect(
      new Date(dbAccessToken.expired_at).valueOf() -
        expectedExpireDate.valueOf()
    ).toBeLessThan(1e3);
  });
  it("should get access token", async function () {
    await accessTokenService.createAccessToken(accessTokenParams);
    const accessToken = await accessTokenService.createAccessToken(
      accessTokenParams
    );
    const dbAccessToken = await accessTokenService.getAccessToken(
      accessToken?.token!
    );
    assert(dbAccessToken?.token === accessToken?.token);
  });
  it("should delete access token", async function () {
    const accessToken = await accessTokenService.createAccessToken(
      accessTokenParams
    );
    await accessTokenService.deleteAccessToken(accessToken?.token!);

    try {
      await accessTokenService.getAccessToken(accessToken?.token!);
    } catch (e) {
      if (e instanceof errors.QueryResultError) {
        assert.equal(e.message, "No data returned from the query.");
      }
    }
  });
});
