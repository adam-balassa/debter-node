type Layer = 'router' | 'authentication' | 'server' | 'data' | 'database';

export type Response<T = any> = Error | Success<T>;

interface IResponse {
  error: boolean;
  statusCode: number;
}

export class Success<T = any> implements IResponse {
  statusCode = 200;
  error = false;
  data: T;
  public constructor(data: T) { this.data = data; }
}

export class Error implements IResponse {
  statusCode: number;
  message: string;
  name: string;
  layer: Layer;
  error = true;
  public constructor(message: string) { this.message = message; }
}

export class RoutingError extends Error {
  statusCode = 404;
  message: string;
  name = 'Routing error';
  layer: Layer = 'router';
  public constructor(message: string) { super(message); }
}

export class AuthenticationError extends Error {
  statusCode = 403;
  message: string;
  name = 'Authentication error';
  layer: Layer = 'authentication';
  public constructor(message: string) { super(message); }
}

export class ServerError extends Error {
  statusCode = 500;
  message: string;
  name = 'Server error';
  layer: Layer = 'server';
  public constructor(message: string) { super(message); }
}

export class ParameterNotProvided extends ServerError {
  public constructor(parameter: string) {
    super(`${parameter} wasn't provided`);
    this.name = 'Parameter not provided';
  }
}

export class DataError extends Error {
  statusCode = 500;
  message: string;
  name = 'Data error';
  layer: Layer = 'data';
  public constructor(message: string) { super(message); }
}

export class DatabaseError extends Error {
  statusCode = 503;
  message: string;
  name = 'Database error';
  layer: Layer = 'database';
  public constructor(message: string) { super(message); }
}
