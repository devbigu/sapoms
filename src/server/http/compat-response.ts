export function compatibilitySuccess<T extends Record<string, unknown>>(data: T, message = "Login successful") {
  return {
    status: true,
    success: true,
    msg: message,
    message,
    data,
  };
}

export function compatibilityFailure(message = "Invalid credentials") {
  return {
    status: false,
    success: false,
    msg: message,
    message,
  };
}

export function withPaginationAliases<T extends Record<string, unknown>>(payload: T) {
  const total = payload.total ?? payload.count ?? payload.recordsTotal ?? payload.recordsFiltered;
  const lastPage = payload.lastPage ?? payload.last_page;
  return {
    status: payload.status ?? true,
    success: payload.success ?? true,
    ...payload,
    ...(total !== undefined ? { count: total, total, recordsTotal: total, recordsFiltered: total } : {}),
    ...(lastPage !== undefined ? { last_page: lastPage, lastPage } : {}),
  };
}
