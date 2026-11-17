import * as migration_20261019_153227_initial from './20261019_153227_initial';
import * as migration_20261025_200206_post_blocks from './20261025_200206_post_blocks';
import * as migration_20261025_204537_visual_post_editor from './20261025_204537_visual_post_editor';
import * as migration_20261025_210023_post_visibility from './20261025_210023_post_visibility';
import * as migration_20261025_212144_post_polls from './20261025_212144_post_polls';
import * as migration_20261108_220804_wedding_program from './20261108_220804_wedding_program';

export const migrations = [
  {
    up: migration_20261019_153227_initial.up,
    down: migration_20261019_153227_initial.down,
    name: '20261019_153227_initial',
  },
  {
    up: migration_20261025_200206_post_blocks.up,
    down: migration_20261025_200206_post_blocks.down,
    name: '20261025_200206_post_blocks',
  },
  {
    up: migration_20261025_204537_visual_post_editor.up,
    down: migration_20261025_204537_visual_post_editor.down,
    name: '20261025_204537_visual_post_editor',
  },
  {
    up: migration_20261025_210023_post_visibility.up,
    down: migration_20261025_210023_post_visibility.down,
    name: '20261025_210023_post_visibility',
  },
  {
    up: migration_20261025_212144_post_polls.up,
    down: migration_20261025_212144_post_polls.down,
    name: '20261025_212144_post_polls',
  },
  {
    up: migration_20261108_220804_wedding_program.up,
    down: migration_20261108_220804_wedding_program.down,
    name: '20261108_220804_wedding_program'
  },
];
