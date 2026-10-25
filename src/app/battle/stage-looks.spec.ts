import { describe, expect, it } from 'vitest';
import { ENGINE_CLASSES, ALL_CLASSES } from '../core/models/unit-class.model';
import { DEFAULT_LOOK, LOOKS, RECIPES, type Recipe, type Time } from './stage-looks';

// Mirrors the engine: the delay before hits land is 0.42 s at normal speed.
const resolve = (time: Time | undefined, speed: number) =>
  ((time?.impact ?? 0) * 0.42 + (time?.seconds ?? 0)) * speed;

describe('skill looks', () => {
  it('styles every skill in the game', () => {
    const skills = [...ALL_CLASSES, ...Object.values(ENGINE_CLASSES)].flatMap((unitClass) =>
      [...unitClass.abilities, ...unitClass.advancedAbilities].map((a) => a.id),
    );
    expect(skills.length).toBeGreaterThan(0);
    expect(skills.filter((id) => !(id in LOOKS))).toEqual([]);
  });

  it('has no look for a skill that does not exist', () => {
    const skills = new Set(
      [...ALL_CLASSES, ...Object.values(ENGINE_CLASSES)].flatMap((u) =>
        [...u.abilities, ...u.advancedAbilities].map((a) => a.id),
      ),
    );
    expect(Object.keys(LOOKS).filter((id) => !skills.has(id))).toEqual([]);
  });

  it('only names deliveries that have a recipe', () => {
    for (const look of [...Object.values(LOOKS), DEFAULT_LOOK]) {
      expect(RECIPES).toHaveProperty(look.delivery);
    }
  });

  it('leaves no recipe unused', () => {
    const used = new Set(Object.values(LOOKS).map((look) => look.delivery));
    used.add(DEFAULT_LOOK.delivery);
    expect(Object.keys(RECIPES).filter((name) => !used.has(name as never))).toEqual([]);
  });
});

describe('recipes', () => {
  const recipes = Object.entries(RECIPES) as [string, Recipe][];

  for (const speed of [1, 0.5, 2]) {
    it(`never schedule a step before the action starts or a span of no length (speed ${speed})`, () => {
      for (const [name, recipe] of recipes) {
        for (const step of recipe.steps) {
          const label = `${name}/${step.do}`;
          expect([label, resolve(step.at, speed) >= 0]).toEqual([label, true]);
          if ('duration' in step)
            expect([label, resolve(step.duration, speed) > 0]).toEqual([label, true]);
        }
      }
    });
  }

  it('times each clip to a moment inside the action', () => {
    for (const [, recipe] of recipes) {
      expect(recipe.clip.key).toBeGreaterThan(0);
      expect(recipe.clip.key).toBeLessThanOrEqual(1);
    }
  });

  it('lands the hits exactly once, unless the skill hits nothing', () => {
    for (const [name, recipe] of recipes) {
      const lands = recipe.steps.filter((step) => step.do === 'land');
      expect([name, lands.length]).toEqual([name, name === 'buff' ? 0 : 1]);
    }
  });
});
