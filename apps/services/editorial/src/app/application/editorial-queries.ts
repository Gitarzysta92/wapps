import { resourceId } from './editorial-input';
import {
  EditorialActor,
  EditorialNotFoundError,
  EditorialReads,
  EditorialResourceKind,
} from './editorial.ports';
import { assertEditorialActor } from './editorial-commands';

export class EditorialQueries {
  constructor(
    private readonly reads: EditorialReads,
    private readonly publicTenant: string
  ) {}

  list(kind: EditorialResourceKind, actor: EditorialActor | null) {
    return this.reads.list(kind, this.tenant(actor));
  }

  async find(
    kind: EditorialResourceKind,
    id: string,
    actor: EditorialActor | null
  ) {
    const value = await this.reads.find(
      kind,
      resourceId(id),
      this.tenant(actor)
    );
    if (!value) throw new EditorialNotFoundError('Resource not found');
    return value;
  }

  private tenant(actor: EditorialActor | null) {
    if (actor) assertEditorialActor(actor);
    return actor?.tenantId ?? this.publicTenant;
  }
}
