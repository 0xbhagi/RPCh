import pgp from "pg-promise";
import { createLogger } from "../utils";
import {
  Client,
  ClientDB,
  FundingRequestDB,
  Quota,
  QuotaDB,
  RegisteredNodeDB,
} from "../types";

export type DBInstance = pgp.IDatabase<{}>;

export type RegisteredNodeFilters = {
  hasExitNode?: boolean;
  excludeList?: string[];
  status?: RegisteredNodeDB["status"];
};

const log = createLogger(["db"]);

const TABLES = {
  REGISTERED_NODES: "registered_nodes",
  FUNDING_REQUESTS: "funding_requests",
  QUOTAS: "quotas",
  CLIENTS: "clients",
};

/**
 * Registered Nodes DB functions
 */

export const getRegisteredNodes = async (
  dbInstance: DBInstance,
  filters?: RegisteredNodeFilters
) => {
  log.verbose("Querying for Registered nodes with filters", filters);
  let baseText = `SELECT * FROM ${TABLES.REGISTERED_NODES}`;
  let filtersText = [];
  const values: { [key: string]: string } = {};

  if (filters?.excludeList !== undefined) {
    filtersText.push("id NOT IN ($<list>)");
    values["list"] = filters.excludeList.join(", ");
  }
  if (filters?.hasExitNode !== undefined) {
    filtersText.push("has_exit_node=$<exitNode>");
    values["exitNode"] = String(filters.hasExitNode === true);
  }
  if (filters?.status !== undefined) {
    filtersText.push("status=$<status>");
    values["status"] = String(filters.status);
  }

  const sqlText = filtersText.length
    ? baseText + " WHERE " + filtersText.join(" AND ")
    : baseText;

  const dbRes: RegisteredNodeDB[] = await dbInstance.manyOrNone(
    sqlText,
    values
  );
  log.verbose(
    "Registered nodes with filters query DB response",
    filters,
    dbRes
  );

  return dbRes;
};
export const saveRegisteredNode = async (
  dbInstance: DBInstance,
  node: Omit<RegisteredNodeDB, "created_at" | "updated_at">
): Promise<boolean> => {
  try {
    const text = `INSERT INTO
    ${TABLES.REGISTERED_NODES} (has_exit_node, id, chain_id, hoprd_api_endpoint, hoprd_api_token, exit_node_pub_key, native_address, total_amount_funded, honesty_score, status)
    VALUES ($<has_exit_node>, $<id>, $<chain_id>, $<hoprd_api_endpoint>, $<hoprd_api_token>, $<exit_node_pub_key>, $<native_address>, $<total_amount_funded>, $<honesty_score>, $<status>)
    RETURNING *`;
    const values: Omit<RegisteredNodeDB, "created_at" | "updated_at"> = {
      has_exit_node: node.has_exit_node,
      id: node.id,
      chain_id: node.chain_id,
      hoprd_api_endpoint: node.hoprd_api_endpoint,
      hoprd_api_token: node.hoprd_api_token,
      exit_node_pub_key: node.exit_node_pub_key,
      native_address: node.native_address,
      total_amount_funded: node.total_amount_funded,
      honesty_score: node.honesty_score,
      status: node.status,
    };
    const dbRes: RegisteredNodeDB = await dbInstance.one(text, values);
    log.verbose("Created new registered node in DB", dbRes);
    return dbRes ? true : false;
  } catch (e) {
    log.error(e);
    return false;
  }
};

export const getRegisteredNode = async (
  dbInstance: DBInstance,
  peerId: string
): Promise<RegisteredNodeDB> => {
  const text = `SELECT * FROM ${TABLES.REGISTERED_NODES} WHERE id=$<peerId>`;
  const values = {
    peerId,
  };
  const dbRes: RegisteredNodeDB = await dbInstance.one(text, values);

  return dbRes;
};

export const updateRegisteredNode = async (
  dbInstance: DBInstance,
  updatedNode: RegisteredNodeDB
): Promise<boolean> => {
  try {
    const text = `UPDATE ${TABLES.REGISTERED_NODES}
    SET has_exit_node = $<has_exit_node>, chain_id = $<chain_id>,
    total_amount_funded = $<total_amount_funded>, honesty_score = $<honesty_score>,
    reason = $<reason>, status = $<status>, updated_at = $<updated_at>
    WHERE id = $<id>
    RETURNING *`;
    const values = {
      id: updatedNode.id,
      has_exit_node: updatedNode.has_exit_node,
      chain_id: updatedNode.chain_id,
      total_amount_funded: updatedNode.total_amount_funded,
      honesty_score: updatedNode.honesty_score,
      reason: updatedNode.reason,
      status: updatedNode.status,
      updated_at: new Date().toISOString(),
    };
    const dbRes: RegisteredNodeDB = await dbInstance.one(text, values);
    return dbRes ? true : false;
  } catch (e) {
    log.error(e);
    return false;
  }
};

export const deleteRegisteredNode = async (
  dbInstance: DBInstance,
  peerId: string
): Promise<RegisteredNodeDB> => {
  const text = `DELETE FROM ${TABLES.REGISTERED_NODES} WHERE id=$<peerId> RETURNING *`;
  const values = {
    peerId,
  };
  const dbRes: RegisteredNodeDB = await dbInstance.one(text, values);

  return dbRes;
};
/**
 * Quota DB functions
 */

export const createQuota = async (
  dbInstance: DBInstance,
  quota: Quota
): Promise<QuotaDB> => {
  const text = `INSERT INTO ${TABLES.QUOTAS} (id, client_id, paid_by, quota, action_taker)
  VALUES (default, $<clientId>, $<paidBy>, $<quota>, $<actionTaker>) RETURNING *`;
  const values: Quota = {
    clientId: quota.clientId,
    quota: quota.quota,
    actionTaker: quota.actionTaker,
    paidBy: quota.paidBy,
  };

  const dbRes: QuotaDB = await dbInstance.one(text, values);
  return dbRes;
};

export const getQuota = async (
  dbInstance: DBInstance,
  id: number
): Promise<QuotaDB> => {
  const text = `SELECT * FROM ${TABLES.QUOTAS} WHERE id=$<id>`;
  const values = {
    id,
  };
  const dbRes: QuotaDB = await dbInstance.one(text, values);
  return dbRes;
};

export const getSumOfQuotasPaidByClient = async (
  dbInstance: DBInstance,
  clientId: string
): Promise<bigint> => {
  const text = `SELECT SUM(quota) FROM ${TABLES.QUOTAS} WHERE paid_by=$<clientId>`;
  const values = {
    clientId,
  };
  const dbRes = await dbInstance.one(text, values);

  return dbRes?.sum ? BigInt(dbRes?.sum) : BigInt(0);
};

export const getSumOfQuotasUsedByClient = async (
  dbInstance: DBInstance,
  clientId: string
): Promise<bigint> => {
  const text = `SELECT SUM(quota) FROM ${TABLES.QUOTAS} WHERE client_id=$<clientId>`;
  const values = {
    clientId,
  };
  const dbRes = await dbInstance.one(text, values);

  return dbRes?.sum ? BigInt(dbRes?.sum) : BigInt(0);
};
export const updateQuota = async (
  dbInstance: DBInstance,
  quota: QuotaDB
): Promise<QuotaDB> => {
  const text = `UPDATE ${TABLES.QUOTAS}
  SET client_id = $<client_id>, paid_by = $<paid_by>, quota = $<quota>, action_taker = $<action_taker>
  WHERE id = $<id>
  RETURNING *`;
  const values: Omit<QuotaDB, "created_at" | "updated_at"> = {
    id: quota.id,
    client_id: quota.client_id,
    action_taker: quota.action_taker,
    quota: quota.quota,
    paid_by: quota.paid_by,
  };
  const dbRes: QuotaDB = await dbInstance.one(text, values);
  return dbRes;
};

export const deleteQuota = async (
  dbInstance: DBInstance,
  id: number
): Promise<QuotaDB> => {
  const text = `DELETE FROM ${TABLES.QUOTAS} WHERE id=$<id> RETURNING *`;
  const values = {
    id,
  };
  const dbRes: QuotaDB = await dbInstance.one(text, values);
  return dbRes;
};

/**
 * Funding Requests DB functions
 */
export const createFundingRequest = async (
  dbInstance: DBInstance,
  fundingRequest: Omit<FundingRequestDB, "created_at" | "updated_at" | "id">
): Promise<FundingRequestDB> => {
  const text = `INSERT INTO ${TABLES.FUNDING_REQUESTS} (id, registered_node_id, request_id, amount)
  VALUES (default, $<registered_node_id>, $<request_id>, $<amount>) RETURNING *`;

  const values: Omit<FundingRequestDB, "created_at" | "updated_at" | "id"> = {
    registered_node_id: fundingRequest.registered_node_id,
    request_id: fundingRequest.request_id,
    amount: fundingRequest.amount,
  };

  const dbRes: FundingRequestDB = await dbInstance.one(text, values);
  return dbRes;
};

/**
 * Client DB functions
 */

export const createClient = async (
  dbInstance: DBInstance,
  client: Client
): Promise<ClientDB> => {
  const text = `INSERT INTO ${TABLES.CLIENTS} (id, payment, labels)
  VALUES ($<id>, $<payment>, $<labels>) RETURNING *`;
  const values: Client = {
    id: client.id,
    payment: client.payment,
    labels: client.labels,
  };
  const dbRes: ClientDB = await dbInstance.one(text, values);
  return dbRes;
};

export const getClient = async (
  dbInstance: DBInstance,
  id: string
): Promise<ClientDB> => {
  const text = `SELECT * FROM ${TABLES.CLIENTS} WHERE id=$<id>`;
  const values = {
    id,
  };
  const dbRes: ClientDB = await dbInstance.one(text, values);
  return dbRes;
};

export const updateClient = async (
  dbInstance: DBInstance,
  client: ClientDB
): Promise<ClientDB> => {
  const text = `UPDATE ${TABLES.CLIENTS}
  SET id = $<id>, payment = $<payment>, labels = $<labels>
  WHERE id = $<id>
  RETURNING *`;
  const values: Omit<ClientDB, "created_at" | "updated_at"> = {
    id: client.id,
    payment: client.payment,
    labels: client.labels,
  };
  const dbRes: ClientDB = await dbInstance.one(text, values);
  return dbRes;
};

export const deleteClient = async (
  dbInstance: DBInstance,
  id: string
): Promise<ClientDB> => {
  const text = `DELETE FROM ${TABLES.CLIENTS} WHERE id=$<id> RETURNING *`;
  const values = {
    id,
  };
  const dbRes: ClientDB = await dbInstance.one(text, values);
  return dbRes;
};
