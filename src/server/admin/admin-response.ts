export function adminListResponse<T>(input: {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
}) {
  const totalPages = input.total === 0 ? 0 : Math.ceil(input.total / input.pageSize);

  return {
    status: true,
    success: true,
    data: input.items,
    count: input.total,
    total: input.total,
    recordsTotal: input.total,
    recordsFiltered: input.total,
    page: input.page,
    pageSize: input.pageSize,
    last_page: totalPages,
    lastPage: totalPages,
  };
}

export function adminDetailResponse<T>(data: T) {
  return {
    status: true,
    success: true,
    data,
  };
}

export function adminMutationResponse<T>(message: string, data?: T) {
  return {
    status: true,
    success: true,
    msg: message,
    message,
    ...(data === undefined ? {} : { data }),
  };
}