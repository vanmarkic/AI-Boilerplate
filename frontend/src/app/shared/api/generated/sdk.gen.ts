import { type Options } from '@hey-api/client-fetch';

import { client } from './client.gen';
import type {
  CreateUserData,
  CreateUserResponse,
  GetUserData,
  GetUserResponse,
} from './types.gen';

export const createUser = (options: Options<CreateUserData, false>) =>
  client.post<CreateUserResponse, unknown, false>({
    url: '/api/users',
    ...options,
  });

export const getUser = (options: Options<GetUserData, false>) =>
  client.get<GetUserResponse, unknown, false>({
    url: '/api/users/{id}',
    ...options,
  });
