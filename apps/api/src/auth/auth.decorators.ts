import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_ROUTE = 'arati:is-public-route';
export const REQUIRED_PERMISSION = 'arati:required-permission';
export const REQUIRE_SAME_ORIGIN = 'arati:require-same-origin';

export const Public = () => SetMetadata(IS_PUBLIC_ROUTE, true);
export const RequirePermission = (permission: string) => SetMetadata(REQUIRED_PERMISSION, permission);
export const RequireSameOrigin = () => SetMetadata(REQUIRE_SAME_ORIGIN, true);
