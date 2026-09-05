import { describe, it, expect, beforeEach } from 'vitest';
import { createTestDatabase } from '../../db/test-helpers';
import { categories, publishers, games } from '../../db/schema';
import type { Database } from './db';
import {
    getAllGames,
    getAllGameIds,
    getGameById,
} from './games';

async function seedGames(db: Database, count: number): Promise<void> {
    const [category] = await db
        .insert(categories)
        .values({ name: 'Strategy', description: 'cat' })
        .returning({ id: categories.id });
    const [publisher] = await db
        .insert(publishers)
        .values({ name: 'Pub One', description: 'pub' })
        .returning({ id: publishers.id });

    // Insert titles in reverse-alphabetical order to prove ordering is applied.
    for (let i = count; i >= 1; i--) {
        await db.insert(games).values({
            title: `Game ${String(i).padStart(2, '0')}`,
            description: `Description ${i}`,
            starRating: 4.2,
            categoryId: category.id,
            publisherId: publisher.id,
        });
    }
}

async function seedFilterGames(db: Database): Promise<{
    categories: { strategy: number; adventure: number; puzzle: number };
    publishers: { alpha: number; beta: number };
}> {
    const insertedCategories = await db
        .insert(categories)
        .values([
            { name: 'Adventure', description: 'adventure' },
            { name: 'Puzzle', description: 'puzzle' },
            { name: 'Strategy', description: 'strategy' },
        ])
        .returning({ id: categories.id, name: categories.name });
    const insertedPublishers = await db
        .insert(publishers)
        .values([
            { name: 'Alpha Games', description: 'alpha' },
            { name: 'Beta Games', description: 'beta' },
        ])
        .returning({ id: publishers.id, name: publishers.name });
    const categoryId = (name: string): number =>
        insertedCategories.find((category) => category.name === name)?.id ?? 0;
    const publisherId = (name: string): number =>
        insertedPublishers.find((publisher) => publisher.name === name)?.id ?? 0;

    await db.insert(games).values([
        { title: 'Alpha Adventure', description: 'one', starRating: 4, categoryId: categoryId('Adventure'), publisherId: publisherId('Alpha Games') },
        { title: 'Alpha Puzzle', description: 'two', starRating: 4, categoryId: categoryId('Puzzle'), publisherId: publisherId('Alpha Games') },
        { title: 'Beta Strategy', description: 'three', starRating: 4, categoryId: categoryId('Strategy'), publisherId: publisherId('Beta Games') },
        { title: 'Beta Puzzle', description: 'four', starRating: 4, categoryId: categoryId('Puzzle'), publisherId: publisherId('Beta Games') },
    ]);

    return {
        categories: {
            strategy: categoryId('Strategy'),
            adventure: categoryId('Adventure'),
            puzzle: categoryId('Puzzle'),
        },
        publishers: {
            alpha: publisherId('Alpha Games'),
            beta: publisherId('Beta Games'),
        },
    };
}

describe('games data-access helpers', () => {
    let db: Database;

    beforeEach(async () => {
        db = await createTestDatabase();
    });

    it('returns all games ordered by title', async () => {
        await seedGames(db, 3);
        const all = await getAllGames(db);
        expect(all.map((g) => g.title)).toEqual(['Game 01', 'Game 02', 'Game 03']);
        expect(all[0].category).toEqual({ id: expect.any(Number), name: 'Strategy' });
        expect(all[0].publisher).toEqual({ id: expect.any(Number), name: 'Pub One' });
    });

    it('returns all game ids ordered by title', async () => {
        await seedGames(db, 3);
        const ids = await getAllGameIds(db);
        const all = await getAllGames(db);
        expect(ids).toEqual(all.map((g) => g.id));
    });

    it('fetches a single game by id', async () => {
        await seedGames(db, 2);
        const ids = await getAllGameIds(db);
        const game = await getGameById(db, ids[0]);
        expect(game?.title).toBe('Game 01');
    });

    it('returns null for a non-existent game', async () => {
        await seedGames(db, 2);
        expect(await getGameById(db, 99999)).toBeNull();
    });

    it('returns all games when no filters are provided', async () => {
        await seedFilterGames(db);
        expect((await getAllGames(db)).map((game) => game.title)).toEqual([
            'Alpha Adventure',
            'Alpha Puzzle',
            'Beta Puzzle',
            'Beta Strategy',
        ]);
    });

    it('filters games by one category', async () => {
        const { categories: categoryIds } = await seedFilterGames(db);
        expect((await getAllGames(db, { categoryIds: [categoryIds.strategy] })).map((game) => game.title)).toEqual([
            'Beta Strategy',
        ]);
    });

    it('filters games by publisher', async () => {
        const { publishers: publisherIds } = await seedFilterGames(db);
        expect((await getAllGames(db, { publisherId: publisherIds.alpha })).map((game) => game.title)).toEqual([
            'Alpha Adventure',
            'Alpha Puzzle',
        ]);
    });

    it('combines category and publisher filters with AND semantics', async () => {
        const { categories: categoryIds, publishers: publisherIds } = await seedFilterGames(db);
        expect((await getAllGames(db, {
            categoryIds: [categoryIds.puzzle],
            publisherId: publisherIds.alpha,
        })).map((game) => game.title)).toEqual(['Alpha Puzzle']);
    });

    it('matches multiple categories with OR semantics', async () => {
        const { categories: categoryIds } = await seedFilterGames(db);
        expect((await getAllGames(db, {
            categoryIds: [categoryIds.adventure, categoryIds.strategy],
        })).map((game) => game.title)).toEqual(['Alpha Adventure', 'Beta Strategy']);
    });

    it('returns an empty array when filters match no games', async () => {
        const { categories: categoryIds, publishers: publisherIds } = await seedFilterGames(db);
        expect(await getAllGames(db, {
            categoryIds: [categoryIds.adventure],
            publisherId: publisherIds.beta,
        })).toEqual([]);
    });
});
