import { AccessTokenService } from "../../access-token";
import { DBInstance } from "../../types";
import { RequestService } from "../../request";
import { doesAccessTokenHaveEnoughBalance } from "./index";
import { MockPgInstanceSingleton } from "@rpch/common/build/internal/db";
import path from "path";
import * as PgMem from "pg-mem";

const SECRET_KEY = "SECRET";
const MAX_AMOUNT_OF_TOKENS = BigInt(40);
const TIMEOUT = 30;

describe("should test entry server middleware functions", function () {
  let dbInstance: DBInstance;
  let accessTokenService: AccessTokenService;
  let requestService: RequestService;

  beforeAll(async function () {
    const migrationsDirectory = path.join(__dirname, "../../../migrations");
    dbInstance = await MockPgInstanceSingleton.getDbInstance(
      PgMem,
      migrationsDirectory
    );
    MockPgInstanceSingleton.getInitialState();
  });

  beforeEach(function () {
    MockPgInstanceSingleton.getInitialState().restore();
    accessTokenService = new AccessTokenService(dbInstance, SECRET_KEY);
    requestService = new RequestService(dbInstance);
  });

  it("should not allow tokens that are requesting more than max amount of tokens", async function () {
    const accessTokenResponse = await accessTokenService.createAccessToken({
      amount: MAX_AMOUNT_OF_TOKENS,
      timeout: TIMEOUT,
    });

    requestService.createRequest({
      amount: MAX_AMOUNT_OF_TOKENS - BigInt(1),
      chainId: 80,
      accessTokenHash: accessTokenResponse.token,
      nodeAddress: "0x0",
    });

    const sumOfRequestsByAccessToken =
      await requestService.getSumOfRequestsByAccessToken(
        accessTokenResponse.token
      );

    const tokenHasBalanceRes = await doesAccessTokenHaveEnoughBalance(
      sumOfRequestsByAccessToken,
      MAX_AMOUNT_OF_TOKENS,
      MAX_AMOUNT_OF_TOKENS
    );
    expect(tokenHasBalanceRes).toEqual(false);
  });
});
