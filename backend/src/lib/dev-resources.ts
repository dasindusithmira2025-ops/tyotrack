import { Prisma } from "@prisma/client";
import { ApiError } from "@/lib/http";
import { prisma } from "@/lib/prisma";

type ModelField = Prisma.DMMF.Field;
type Model = Prisma.DMMF.Model;

interface FilterOperatorPayload {
  op: string;
  value?: unknown;
  from?: unknown;
  to?: unknown;
}

type FilterValue = unknown | FilterOperatorPayload;

function toDelegateName(modelName: string): string {
  return modelName.charAt(0).toLowerCase() + modelName.slice(1);
}

function getModelByResource(resource: string): Model {
  const normalized = resource.trim();
  const model = Prisma.dmmf.datamodel.models.find(
    (item) =>
      item.name.toLowerCase() === normalized.toLowerCase() ||
      toDelegateName(item.name).toLowerCase() === normalized.toLowerCase()
  );

  if (!model) {
    throw new ApiError(404, `Unknown resource: ${resource}`);
  }

  return model;
}

function getFieldByName(model: Model, fieldName: string): ModelField {
  const field = model.fields.find((item) => item.name === fieldName);
  if (!field) {
    throw new ApiError(400, `Unknown field "${fieldName}" for ${model.name}`);
  }
  return field;
}

function coerceValueByType(fieldType: string, value: unknown): unknown {
  if (value === null || value === undefined) {
    return value;
  }

  if (fieldType === "Int") {
    return Number(value);
  }
  if (fieldType === "Float" || fieldType === "Decimal") {
    return Number(value);
  }
  if (fieldType === "BigInt") {
    return BigInt(String(value));
  }
  if (fieldType === "Boolean") {
    if (typeof value === "boolean") {
      return value;
    }
    const normalized = String(value).toLowerCase().trim();
    return normalized === "true" || normalized === "1";
  }
  if (fieldType === "DateTime") {
    return new Date(String(value));
  }

  return value;
}

export function listDevResources() {
  return Prisma.dmmf.datamodel.models.map((model) => {
    const idField = model.fields.find((field) => field.isId);
    const relationFields = model.fields
      .filter((field) => field.kind === "object")
      .map((field) => ({
        name: field.name,
        type: field.type,
        relationName: field.relationName,
        relationFromFields: field.relationFromFields ?? [],
        relationToFields: field.relationToFields ?? []
      }));

    return {
      name: model.name,
      delegate: toDelegateName(model.name),
      dbName: model.dbName ?? model.name,
      primaryKey: idField
        ? {
            field: idField.name,
            type: idField.type,
            required: idField.isRequired
          }
        : null,
      fields: model.fields.map((field) => ({
        name: field.name,
        type: field.type,
        kind: field.kind,
        isId: field.isId,
        isUnique: field.isUnique,
        isRequired: field.isRequired,
        isList: field.isList,
        hasDefaultValue: field.hasDefaultValue,
        default: field.default,
        relationName: field.relationName,
        relationFromFields: field.relationFromFields ?? [],
        relationToFields: field.relationToFields ?? []
      })),
      relationFields
    };
  });
}

export function getDevDelegate(resource: string) {
  const model = getModelByResource(resource);
  const delegateName = toDelegateName(model.name);
  const delegate = (prisma as unknown as Record<string, unknown>)[delegateName] as Record<string, unknown> | undefined;

  if (!delegate || typeof delegate.findMany !== "function") {
    throw new ApiError(500, `Delegate unavailable for resource: ${model.name}`);
  }

  return { model, delegateName, delegate };
}

export function getPrimaryKeyField(resource: string): ModelField {
  const { model } = getDevDelegate(resource);
  const primaryKeyField = model.fields.find((field) => field.isId);
  if (!primaryKeyField) {
    throw new ApiError(400, `Resource ${model.name} does not expose a single primary key`);
  }
  return primaryKeyField;
}

export function coercePrimaryIdValue(resource: string, rawValue: string): unknown {
  const primaryKeyField = getPrimaryKeyField(resource);
  return coerceValueByType(String(primaryKeyField.type), rawValue);
}

export function parseFilterParam(rawFilters: string | null): Record<string, FilterValue> {
  if (!rawFilters) {
    return {};
  }

  try {
    const parsed = JSON.parse(rawFilters) as Record<string, FilterValue>;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return {};
    }
    return parsed;
  } catch {
    throw new ApiError(400, "filters must be valid JSON");
  }
}

function buildOperatorFilter(fieldType: string, value: FilterOperatorPayload): Record<string, unknown> {
  const op = value.op?.toLowerCase();
  if (!op) {
    return { equals: null };
  }

  if (op === "contains") {
    return { contains: String(value.value ?? ""), mode: "insensitive" };
  }
  if (op === "startswith") {
    return { startsWith: String(value.value ?? ""), mode: "insensitive" };
  }
  if (op === "endswith") {
    return { endsWith: String(value.value ?? ""), mode: "insensitive" };
  }
  if (op === "gt") {
    return { gt: coerceValueByType(fieldType, value.value) };
  }
  if (op === "gte") {
    return { gte: coerceValueByType(fieldType, value.value) };
  }
  if (op === "lt") {
    return { lt: coerceValueByType(fieldType, value.value) };
  }
  if (op === "lte") {
    return { lte: coerceValueByType(fieldType, value.value) };
  }
  if (op === "in") {
    const list = Array.isArray(value.value) ? value.value : [];
    return { in: list.map((item) => coerceValueByType(fieldType, item)) };
  }
  if (op === "between") {
    return {
      gte: coerceValueByType(fieldType, value.from),
      lte: coerceValueByType(fieldType, value.to)
    };
  }
  if (op === "isnull") {
    return { equals: null };
  }

  return { equals: coerceValueByType(fieldType, value.value) };
}

export function buildWhereClause(resource: string, filters: Record<string, FilterValue>) {
  const { model } = getDevDelegate(resource);
  const where: Record<string, unknown> = {};

  for (const [fieldName, rawValue] of Object.entries(filters)) {
    const field = getFieldByName(model, fieldName);
    const fieldType = String(field.type);

    if (rawValue && typeof rawValue === "object" && !Array.isArray(rawValue) && "op" in rawValue) {
      where[fieldName] = buildOperatorFilter(fieldType, rawValue as FilterOperatorPayload);
    } else {
      where[fieldName] = coerceValueByType(fieldType, rawValue);
    }
  }

  return where;
}

export function buildOrderBy(resource: string, sortField?: string | null, sortOrder?: string | null) {
  if (!sortField) {
    return undefined;
  }

  const { model } = getDevDelegate(resource);
  getFieldByName(model, sortField);

  const order = sortOrder?.toLowerCase() === "asc" ? "asc" : "desc";
  return { [sortField]: order };
}

export function sanitizeDataForModel(resource: string, data: Record<string, unknown>) {
  const { model } = getDevDelegate(resource);
  const sanitized: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(data)) {
    const field = model.fields.find((item) => item.name === key);
    if (!field) {
      continue;
    }

    if (field.kind === "object") {
      continue;
    }

    if (Array.isArray(value) && field.isList) {
      sanitized[key] = value.map((item) => coerceValueByType(String(field.type), item));
      continue;
    }

    sanitized[key] = coerceValueByType(String(field.type), value);
  }

  return sanitized;
}
