// Path registration for TypeScript path aliases
import { register } from 'tsconfig-paths';
// import { compilerOptions } from './tsconfig.json';

// Register TypeScript paths
register({
  baseUrl: './src',
  paths: {
    '@/*': ['*'],
    '@config/*': ['config/*'],
    '@controllers/*': ['controllers/*'],
    '@lib/*': ['lib/*'],
    '@middlewares/*': ['middlewares/*'],
    '@routes/*': ['routes/*'],
    '@services/*': ['services/*'],
    '@types/*': ['types/*'],
    '@utils/*': ['utils/*'],
  },
});
