export interface CreateUserRequest {
  email: string;
  name: string;
}

export interface UserResponse {
  id: number;
  email: string;
  name: string;
  created_at: string;
}

export type CreateUserData = {
  body: CreateUserRequest;
  url: '/api/users';
};

export type CreateUserResponse = UserResponse;

export type GetUserData = {
  path: {
    id: number;
  };
  url: '/api/users/{id}';
};

export type GetUserResponse = UserResponse;
