import { describe, it } from "node:test"
import assert from "node:assert/strict"
import { Exit } from "effect"
import {
	decodePostFrontmatter,
	decodePublishedPost,
	POST_CATEGORIES,
} from "../src/schema/frontmatter.js"

describe("PostFrontmatter schema", () => {
	it("accepts a valid minimal post", () => {
		const result = decodePostFrontmatter({
			title: "Test Post",
			date: "2026-03-04",
		})
		assert.equal(Exit.isSuccess(result), true)
	})

	it("accepts a fully populated post", () => {
		const result = decodePostFrontmatter({
			title: "Full Post",
			date: "2026-03-04",
			description: "A test post about testing",
			tags: ["testing", "typescript"],
			category: "software",
			published: true,
			featured: false,
			feature_image: "/images/posts/test.jpg",
			reading_time: 5,
			slug: "full-post",
			source_repo: "Jesssullivan/some-repo",
			source_path: "blog/post.md",
		})
		assert.equal(Exit.isSuccess(result), true)
	})

	it("rejects missing title", () => {
		const result = decodePostFrontmatter({ date: "2026-03-04" })
		assert.equal(Exit.isFailure(result), true)
	})

	it("rejects missing date", () => {
		const result = decodePostFrontmatter({ title: "No Date" })
		assert.equal(Exit.isFailure(result), true)
	})

	it("rejects invalid date format", () => {
		const result = decodePostFrontmatter({
			title: "Bad Date",
			date: "March 4, 2026",
		})
		assert.equal(Exit.isFailure(result), true)
	})

	it("rejects invalid category", () => {
		const result = decodePostFrontmatter({
			title: "Bad Cat",
			date: "2026-03-04",
			category: "nonexistent",
		})
		assert.equal(Exit.isFailure(result), true)
	})

	it("accepts all valid categories", () => {
		for (const category of POST_CATEGORIES) {
			const result = decodePostFrontmatter({
				title: "Test",
				date: "2026-01-01",
				category,
			})
			assert.equal(Exit.isSuccess(result), true)
		}
	})

	it("accepts optional fields as undefined", () => {
		const result = decodePostFrontmatter({
			title: "Minimal",
			date: "2026-01-01",
		})
		assert.equal(Exit.isSuccess(result), true)
	})
})

describe("PublishedPost schema (strict)", () => {
	const validPublished = {
		title: "Published Post",
		date: "2026-03-04",
		description: "A compelling description for SEO purposes",
		tags: ["typescript", "effect"],
		category: "software" as const,
		published: true as const,
	}

	it("accepts a valid published post", () => {
		const result = decodePublishedPost(validPublished)
		assert.equal(Exit.isSuccess(result), true)
	})

	it("rejects published post without description", () => {
		const { description: _, ...noDesc } = validPublished
		const result = decodePublishedPost(noDesc)
		assert.equal(Exit.isFailure(result), true)
	})

	it("rejects published post with short description", () => {
		const result = decodePublishedPost({
			...validPublished,
			description: "Short",
		})
		assert.equal(Exit.isFailure(result), true)
	})

	it("rejects published post without tags", () => {
		const { tags: _, ...noTags } = validPublished
		const result = decodePublishedPost(noTags)
		assert.equal(Exit.isFailure(result), true)
	})

	it("rejects published post with empty tags", () => {
		const result = decodePublishedPost({ ...validPublished, tags: [] })
		assert.equal(Exit.isFailure(result), true)
	})

	it("rejects draft post", () => {
		const result = decodePublishedPost({
			...validPublished,
			published: false,
		})
		assert.equal(Exit.isFailure(result), true)
	})

	it("rejects post without category", () => {
		const { category: _, ...noCat } = validPublished
		const result = decodePublishedPost(noCat)
		assert.equal(Exit.isFailure(result), true)
	})
})
