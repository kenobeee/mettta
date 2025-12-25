#!/usr/bin/env node
/**
 * Удаляет вспомогательные артефакты сборки (blockmap, latest*.yml),
 * чтобы в release оставались только установщики (.dmg/.exe) и отладочные файлы.
 */
const fs = require('fs/promises');
const path = require('path');

const releaseDir = path.join(__dirname, '..', 'release');
const shouldRemove = (name) =>
  name.endsWith('.blockmap') || /^latest.*\.yml$/i.test(name);

async function clean() {
  let entries;
  try {
    entries = await fs.readdir(releaseDir);
  } catch (err) {
    console.error(`[clean-artifacts] Не удалось прочитать ${releaseDir}:`, err);
    process.exit(1);
  }

  const targets = entries.filter(shouldRemove);
  if (targets.length === 0) {
    console.log('[clean-artifacts] Нечего удалять');
    return;
  }

  await Promise.all(
    targets.map(async (name) => {
      const fullPath = path.join(releaseDir, name);
      try {
        await fs.rm(fullPath, { force: true });
        console.log(`[clean-artifacts] Удалено: ${name}`);
      } catch (err) {
        console.error(`[clean-artifacts] Ошибка удаления ${name}:`, err);
        process.exitCode = 1;
      }
    })
  );
}

void clean();

