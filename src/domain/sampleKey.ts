import { computeBittingProfile } from './bitting';
import { inToMm } from './keyways';
import type { AnchorAlignment, KeywaySpec } from './types';

export interface SampleKeyPhotoResult {
  dataUrl: string;
  width: number;
  height: number;
  groundTruthKeywayId: string;
  groundTruthCuts: number[];
  /** Suggested starting anchor alignment close to the key in the photo */
  initialAlignment: AnchorAlignment;
}

/**
 * Generates a realistic, high-contrast synthetic photograph of a brass pin-tumbler key
 * resting on a dark cutting mat with subtle grain, metallic shading, shadow, and warding lines.
 * Used for instant 100% offline testing without requiring the user to upload a personal key photo.
 */
export function generateSampleKeyPhoto(
  spec: KeywaySpec,
  cuts: readonly number[],
): SampleKeyPhotoResult {
  const width = 1280;
  const height = 720;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');

  // Normalized shoulder and tip locations in image space (slight realistic tilt ~ -4.5 deg)
  const shoulderPx = { x: 465, y: 392 };
  const bladeLengthMm = inToMm(spec.bladeLengthIn);
  const bladeWidthMm = inToMm(spec.bladeWidthIn);
  const pxPerMm = 18.2;
  const angleRad = (-4.2 * Math.PI) / 180;

  const tipPx = {
    x: shoulderPx.x + Math.cos(angleRad) * bladeLengthMm * pxPerMm,
    y: shoulderPx.y + Math.sin(angleRad) * bladeLengthMm * pxPerMm,
  };

  if (ctx) {
    // 1. Matte slate workshop mat background with subtle radial vignette
    const bgGrad = ctx.createRadialGradient(width * 0.52, height * 0.48, 80, width * 0.5, height * 0.5, 760);
    bgGrad.addColorStop(0, '#272a30');
    bgGrad.addColorStop(0.65, '#1b1d22');
    bgGrad.addColorStop(1, '#121317');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    // Subtle cutting-mat calibration grid
    ctx.strokeStyle = 'rgba(255,255,255,0.035)';
    ctx.lineWidth = 1;
    const gridStep = 48;
    for (let x = 0; x < width; x += gridStep) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
    for (let y = 0; y < height; y += gridStep) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    // Ruler edge at bottom of photo for authentic workshop context
    ctx.fillStyle = 'rgba(255,255,255,0.07)';
    ctx.font = '600 13px ui-monospace, SFMono-Regular, monospace';
    ctx.fillText(`SAMPLE KEY PHOTO · ${spec.code} · LOCAL SYNTHETIC REFERENCE`, 32, height - 28);

    // 2. Transform into key coordinate frame (origin at shoulder bottom spine, +X right, +Y UP -> canvas -Y)
    ctx.save();
    ctx.translate(shoulderPx.x, shoulderPx.y);
    ctx.rotate(angleRad);
    ctx.scale(pxPerMm, -pxPerMm);

    const profile = computeBittingProfile(spec, cuts);
    const bow = spec.bow;
    const bowCenterY = bladeWidthMm * 0.5;
    const bowHalfH = bow.widthMm * 0.5;

    const buildKeyPath = () => {
      ctx.beginPath();
      // Start at shoulder bottom spine (0, 0) -> blade spine to tip
      ctx.moveTo(0, 0);
      ctx.lineTo(bladeLengthMm, 0);
      // Up to tip end of top profile
      const lastPt = profile[profile.length - 1]!;
      ctx.lineTo(lastPt.x, lastPt.y);
      // Walk top bitting profile back to shoulder (x = 0)
      for (let i = profile.length - 2; i >= 0; i--) {
        const p = profile[i]!;
        ctx.lineTo(p.x, p.y);
      }
      // Upper shoulder step
      ctx.lineTo(0, bladeWidthMm + bow.shoulderTopExtraMm);
      ctx.lineTo(-2.2, bladeWidthMm + bow.shoulderTopExtraMm);
      // Rounded octagonal/classic bow
      ctx.quadraticCurveTo(-5.5, bowCenterY + bowHalfH, -11.5, bowCenterY + bowHalfH);
      ctx.lineTo(-bow.lengthMm + 5.0, bowCenterY + bowHalfH);
      ctx.quadraticCurveTo(-bow.lengthMm, bowCenterY + bowHalfH, -bow.lengthMm, bowCenterY + bowHalfH - 5.2);
      ctx.lineTo(-bow.lengthMm, bowCenterY - bowHalfH + 5.2);
      ctx.quadraticCurveTo(-bow.lengthMm, bowCenterY - bowHalfH, -bow.lengthMm + 5.0, bowCenterY - bowHalfH);
      ctx.lineTo(-11.5, bowCenterY - bowHalfH);
      ctx.quadraticCurveTo(-5.5, bowCenterY - bowHalfH, -2.2, -bow.shoulderBottomExtraMm);
      ctx.lineTo(0, -bow.shoulderBottomExtraMm);
      ctx.closePath();

      // Keyring hole cutout (even-odd)
      ctx.moveTo(bow.holeCenterXMm + bow.holeRadiusMm, bowCenterY);
      ctx.arc(bow.holeCenterXMm, bowCenterY, bow.holeRadiusMm, 0, Math.PI * 2, true);
    };

    // Soft cast drop shadow
    ctx.save();
    ctx.shadowColor = 'rgba(0, 0, 0, 0.72)';
    ctx.shadowBlur = 24;
    ctx.shadowOffsetX = 6;
    ctx.shadowOffsetY = 14;
    buildKeyPath();
    ctx.fillStyle = '#a88332';
    ctx.fill('evenodd');
    ctx.restore();

    // Brushed brass metallic gradient fill
    const brassGrad = ctx.createLinearGradient(-bow.lengthMm, bowCenterY + bowHalfH, bladeLengthMm, bowCenterY - bowHalfH);
    brassGrad.addColorStop(0.0, '#c89f48');
    brassGrad.addColorStop(0.22, '#e8cb7a');
    brassGrad.addColorStop(0.45, '#b68c37');
    brassGrad.addColorStop(0.68, '#edd389');
    brassGrad.addColorStop(0.88, '#c0963e');
    brassGrad.addColorStop(1.0, '#9e7729');

    buildKeyPath();
    ctx.fillStyle = brassGrad;
    ctx.fill('evenodd');

    // Clip to key silhouette for brushed metal lines and milled warding grooves
    ctx.save();
    buildKeyPath();
    ctx.clip('evenodd');

    // Fine brushed brass streaks
    ctx.strokeStyle = 'rgba(255, 248, 220, 0.08)';
    ctx.lineWidth = 0.08;
    for (let y = -bowHalfH; y <= bowCenterY + bowHalfH; y += 0.35) {
      ctx.beginPath();
      ctx.moveTo(-bow.lengthMm, y);
      ctx.lineTo(bladeLengthMm, y);
      ctx.stroke();
    }

    // Warding grooves milled along the blade
    for (const groove of spec.warding) {
      if (groove.side !== 'top') continue;
      const y0 = groove.yStartRatio * bladeWidthMm;
      const y1 = groove.yEndRatio * bladeWidthMm;
      const grooveGrad = ctx.createLinearGradient(0, y1, 0, y0);
      grooveGrad.addColorStop(0, 'rgba(55, 38, 10, 0.58)');
      grooveGrad.addColorStop(0.25, 'rgba(92, 66, 20, 0.38)');
      grooveGrad.addColorStop(0.75, 'rgba(130, 96, 32, 0.25)');
      grooveGrad.addColorStop(1, 'rgba(255, 236, 170, 0.36)');
      ctx.fillStyle = grooveGrad;
      ctx.fillRect(0.6, y0, bladeLengthMm, y1 - y0);
    }

    // Stamped code on bow
    ctx.save();
    ctx.scale(1, -1);
    ctx.fillStyle = 'rgba(72, 50, 12, 0.55)';
    ctx.font = '700 3.2px ui-monospace, monospace';
    ctx.textAlign = 'center';
    ctx.fillText(spec.code, -10.5, -bowCenterY + 1.1);
    ctx.restore();

    ctx.restore(); // end clip

    // Crisp metallic bevel outline
    buildKeyPath();
    ctx.strokeStyle = 'rgba(255, 240, 185, 0.45)';
    ctx.lineWidth = 0.14;
    ctx.stroke();

    ctx.restore();
  }

  return {
    dataUrl: canvas.toDataURL('image/png'),
    width,
    height,
    groundTruthKeywayId: spec.id,
    groundTruthCuts: [...cuts],
    initialAlignment: {
      shoulder: { x: shoulderPx.x / width, y: shoulderPx.y / height },
      tip: { x: tipPx.x / width, y: tipPx.y / height },
      rotationOffsetDeg: 0,
      scaleMultiplier: 1,
      heightScaleMultiplier: 1,
      skewY: 0,
      flipVertical: false,
    },
  };
}
