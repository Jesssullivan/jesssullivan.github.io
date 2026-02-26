---
title: "Ligature Test Fixture"
date: "2024-12-31"
description: "Test fixture post for verifying Fira Code ligatures render correctly in code blocks."
tags: ["test"]
published: true
slug: "ligature-test-fixture"
feature_image: "/images/posts/orange-wood-ducks.jpg"
category: "hardware"
---

This post exists to verify that Fira Code ligatures render in code blocks.

```typescript
// Arrow functions with =>
const add = (a: number, b: number) => a + b;

// Strict equality
if (x !== y && a === b) {
  console.log("ligatures active");
}

// Comparison operators
const check = (a: number) => a >= 10 && a <= 100;

// Not equal
if (a != b) return false;

// Type annotations
const map: Map<string, number> = new Map();
```

Inline code with ligatures: `const fn = () => x !== y`
