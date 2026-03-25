{
  "code": "import { verify } from 'https://deno.land/x/jose@4.14.0/cwt/jose.ts';
import { getRequiredHeader } from './utils.ts';

interface UserContext {
  email: string;
  name: string;
  groups: string[];
  roles: string[];
}

interface Env {
  CF_ACCESS_ISSUER: string;
  CF_ACCESS_AUDIENCE: string;
  AZURE_AD_GROUP_MAPPING: string;
}

const AZURE_AD_GROUP_MAPPING_DEFAULT: { [key: string]: string[] } = {
  'admin-group': ['admin'],
  'lead-group': ['lead'],
  'consultant-group': ['consultant'],
  'viewer-group': ['viewer'],
};

const validateAccessJWT = async (request: Request, env: Env) => {
  const cfAccessJwt = getRequiredHeader(request, 'CF-Access-JWT-Assertion');
  const token = cfAccessJwt;

  const config = {
    issuer: env.CF_ACCESS_ISSUER,
    audience: env.CF_ACCESS_AUDIENCE,
  };

  try {
    const payload = await verify(token, config);
    return payload;
  } catch (error) {