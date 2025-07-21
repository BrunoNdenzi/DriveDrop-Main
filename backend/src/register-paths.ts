// Path registration for TypeScript path aliases
import { register } from 'tsconfig-paths';
import { compilerOptions } from './tsconfig.json';

// Register TypeScript paths
register({
  baseUrl: './src',
  paths: compilerOptions.paths,
});
