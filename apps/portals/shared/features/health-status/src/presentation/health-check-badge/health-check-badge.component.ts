import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { TuiBadge } from '@taiga-ui/kit';
import { TuiIcon } from '@taiga-ui/core';
import { ApplicationHealthStatusCode } from '@domains/feed';

/**
 * ARCH: Health Check Badge Component
 * 
 * This component uses a hybrid approach to combine TuiBadge directive with custom icon handling:
 * 
 * 1. TuiBadge is applied as a host directive to enable composability - properties like 'size'
 *    can be passed directly to the component without manual input boilerplate:
 *    <health-check-badge size="m" />
 * 
 * 2. The icon is handled separately in the template using TuiIcon component because:
 *    - TuiBadge's iconStart input comes from a nested host directive chain 
 *      (TuiBadge -> TuiWithIcons -> TuiIcons)
 *    - Angular's host directives feature doesn't expose inputs from nested host directives
 *    - This is a known limitation: only direct inputs of the host directive can be exposed
 *    - Attempting to bind iconStart via host bindings or inject() workarounds fails because
 *      the nested directive properties are not publicly accessible
 * 
 * This approach provides the best balance between composability and working within Angular's
 * host directive limitations.
 */
@Component({
  selector: 'health-check-badge',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    TuiIcon,
  ],
  hostDirectives: [
    { directive: TuiBadge, inputs: ['size'] },
  ],
  templateUrl: './health-check-badge.component.html',
  styleUrls: ['./health-check-badge.component.scss'],
  host: {
    '[class]': 'class()'
  }
})
export class HealthCheckBadgeComponent {

  public readonly status = input.required<{ code: ApplicationHealthStatusCode; message: string }>();
  public readonly icon = computed(() => this._getIcon(this.status().code));
  public readonly class = computed(() => this._getClass(this.status().code));

  private _getIcon(code: ApplicationHealthStatusCode): string {
    switch (code) {
      case ApplicationHealthStatusCode.Operational:
        return '@tui.check-circle';
      case ApplicationHealthStatusCode.Degraded:
        return '@tui.alert-circle';
      case ApplicationHealthStatusCode.Outage:
        return '@tui.alert-circle';
      default:
        return '@tui.info';
    }
  }

  private _getClass(code: ApplicationHealthStatusCode): string {
    switch (code) {
      case ApplicationHealthStatusCode.Operational:
        return 'operational';
      case ApplicationHealthStatusCode.Degraded:
        return 'degraded';
      case ApplicationHealthStatusCode.Outage:
        return 'outage';
      default:
        return 'info';
    }
  }
}

