/**
 * SSE channel name type.
 *
 * After `make generate`, the OpenAPI spec includes an enum of registered
 * channel names. The generated `SubscribeToChannelData` type will
 * contain the union of valid channel names in its path parameter.
 *
 * Import this type in feature stores to constrain the channel name:
 *
 *   import type { SseChannel } from '../../shared/sse/sse-channel.type';
 *   withLiveEvents<CommentResponse, SseChannel>('comments', { ... });
 *
 * Until `make generate` is run with registered channels, this falls
 * back to `string` so the code compiles without a generated spec.
 */
import type { SubscribeToChannelData } from '../api/generated/types.gen';

type ExtractChannel<T> = T extends { path: { channel: infer C } } ? C : string;

export type SseChannel = ExtractChannel<SubscribeToChannelData>;
