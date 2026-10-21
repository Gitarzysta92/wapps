import 'reflect-metadata';
import { MODULE_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import {
  DiscussionsController,
  DISCUSSION_HTTP_OPTIONS,
} from '@sdk/features/discussion/http';
import { DiscussionsModule } from './discussions.module';

// Metadata inspection does not generate IDs; uuid's ESM runtime is qualified separately.
jest.mock('uuid', () => ({ v7: jest.fn() }));

describe('deployed Discussion HTTP boundary', () => {
  it('registers the reusable transport and supplies consumer dependencies at composition', () => {
    const controllers: unknown[] = Reflect.getMetadata(
      MODULE_METADATA.CONTROLLERS,
      DiscussionsModule
    );
    const providers: Array<{ provide?: unknown }> = Reflect.getMetadata(
      MODULE_METADATA.PROVIDERS,
      DiscussionsModule
    );
    expect(controllers).toContain(DiscussionsController);
    expect(
      controllers.filter((controller) => controller === DiscussionsController)
    ).toHaveLength(1);
    expect(
      providers.some((provider) => provider.provide === DISCUSSION_HTTP_OPTIONS)
    ).toBe(true);
  });

  it('does not register the retired frontend routes on the owning service', () => {
    const controllers: object[] = Reflect.getMetadata(
      MODULE_METADATA.CONTROLLERS,
      DiscussionsModule
    );
    const paths = controllers.map((controller) =>
      Reflect.getMetadata(PATH_METADATA, controller)
    );
    expect(paths.filter((path) => path === 'discussions')).toHaveLength(1);
    for (const path of [
      'discussion-bindings',
      'application-discussions/:applicationId',
      'article-comments/:articleId',
      'me/discussions',
      'discussion-selection',
    ])
      expect(paths).not.toContain(path);
  });
});
