/**
 * DKCドライブ - 図形SVG生成ユーティリティ
 * スプレッドシート図形・HTML編集で共通利用
 */
import { SHAPE_TYPES, SHAPE_DEFAULTS } from './constants.js';

/**
 * 図形タイプに応じたSVGを生成（純粋関数）
 * @param {Object} shapeData - 図形データ
 * @param {string} shapeData.shapeType - 図形タイプ（SHAPE_TYPES）
 * @param {number} shapeData.width - 幅
 * @param {number} shapeData.height - 高さ
 * @param {string} [shapeData.fillColor] - 塗りつぶし色
 * @param {string} [shapeData.strokeColor] - 枠線色
 * @param {number} [shapeData.strokeWidth] - 枠線幅
 * @param {number} [shapeData.opacity] - 不透明度
 * @returns {string} SVG文字列
 */
export function generateShapeSVG(shapeData) {
    const w = shapeData.width;
    const h = shapeData.height;
    const fill = shapeData.fillColor != null ? shapeData.fillColor : SHAPE_DEFAULTS.fillColor;
    const stroke = shapeData.strokeColor || SHAPE_DEFAULTS.strokeColor;
    const sw = shapeData.strokeWidth ?? SHAPE_DEFAULTS.strokeWidth;
    const opacity = shapeData.opacity ?? 1.0;

    const pad = sw / 2;
    let inner = '';

    switch (shapeData.shapeType) {
        case SHAPE_TYPES.RECTANGLE:
            inner = `<rect x="${pad}" y="${pad}" width="${w - sw}" height="${h - sw}"
                fill="${fill}" stroke="${stroke}" stroke-width="${sw}" opacity="${opacity}"/>`;
            break;

        case SHAPE_TYPES.ROUNDED_RECTANGLE: {
            const r = Math.min(w, h) / 5;
            inner = `<rect x="${pad}" y="${pad}" width="${w - sw}" height="${h - sw}"
                rx="${r}" ry="${r}"
                fill="${fill}" stroke="${stroke}" stroke-width="${sw}" opacity="${opacity}"/>`;
            break;
        }

        case SHAPE_TYPES.ELLIPSE:
            inner = `<ellipse cx="${w / 2}" cy="${h / 2}" rx="${(w - sw) / 2}" ry="${(h - sw) / 2}"
                fill="${fill}" stroke="${stroke}" stroke-width="${sw}" opacity="${opacity}"/>`;
            break;

        case SHAPE_TYPES.TRIANGLE: {
            const pts = `${w / 2},${pad} ${pad},${h - pad} ${w - pad},${h - pad}`;
            inner = `<polygon points="${pts}"
                fill="${fill}" stroke="${stroke}" stroke-width="${sw}" opacity="${opacity}"/>`;
            break;
        }

        case SHAPE_TYPES.LINE:
            inner = `<line x1="${pad}" y1="${h / 2}" x2="${w - pad}" y2="${h / 2}"
                stroke="${stroke}" stroke-width="${sw}" opacity="${opacity}"/>`;
            break;

        case SHAPE_TYPES.ARROW: {
            const arrowSize = Math.max(8, sw * 3);
            const midY = h / 2;
            const endX = w - pad;
            inner = `<line x1="${pad}" y1="${midY}" x2="${endX}" y2="${midY}"
                stroke="${stroke}" stroke-width="${sw}" opacity="${opacity}"/>
                <polygon points="${endX},${midY} ${endX - arrowSize},${midY - arrowSize / 2} ${endX - arrowSize},${midY + arrowSize / 2}"
                fill="${stroke}" opacity="${opacity}"/>`;
            break;
        }
    }

    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">${inner}</svg>`;
}
