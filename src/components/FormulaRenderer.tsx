import React from 'react';

// Container / Node types (same as LearningPage)
export type Container = {
  children: FormulaNode[];
};

export type FormulaNode =
  | { type: 'symbol'; value: string }
  | { type: 'fraction'; numerator: Container; denominator: Container }
  | { type: 'superscript'; base: Container; exponent: Container }
  | { type: 'subscript'; base: Container; index: Container }
  | { type: 'sqrt'; content: Container }
  | { type: 'sum'; lower: Container; upper: Container; body: Container }
  | { type: 'integral'; lower: Container; upper: Container; body: Container }
  | { type: 'function'; name: string; argument: Container }
  | { type: 'abs'; content: Container };

export type FormulaRoot = Container;

export type MaskBlock = { id: string };

type Props = {
  root?: FormulaRoot | null;
  /** fallback plain text when no structure data is present */
  fallback?: string;
  className?: string;
  /** optional masks (used in LearningPage). Lists can pass [] */
  maskBlocks?: MaskBlock[];
  /** whether mask is revealed; default true (lists) */
  isMaskRevealed?: (maskId: string) => boolean;
  /** when user taps a mask block */
  onRevealMask?: (maskId: string) => void;
};

export default function FormulaRenderer({
  root,
  fallback,
  className,
  maskBlocks = [],
  isMaskRevealed,
  onRevealMask,
}: Props) {
  const renderContainer = (container: Container, path: (number | string)[]): React.ReactNode => {
    return (
      <span className="inline-flex items-center gap-0.5 leading-none">
        {container.children.map((child, index) => (
          <React.Fragment key={`${path.join('-')}-${index}`}>
            {renderNode(child, [...path, index])}
          </React.Fragment>
        ))}
      </span>
    );
  };

  const renderNode = (node: FormulaNode, path: (number | string)[]): React.ReactNode => {
    const maskId = `formula-${path.join('-')}`;
    const mask = maskBlocks.find((b) => b.id === maskId);

    if (mask) {
      const revealed = isMaskRevealed ? isMaskRevealed(mask.id) : true;
      if (!revealed) {
        return (
          <button
            type="button"
            onClick={() => onRevealMask?.(mask.id)}
            className="inline-block px-2 py-0.5 mx-0.5 rounded bg-muted/50 text-muted-foreground hover:bg-muted transition-colors"
          >
            ?
          </button>
        );
      }
    }

    switch (node.type) {
      case 'symbol':
        return <span className="font-mono leading-none">{node.value}</span>;

      case 'fraction':
        return (
          // Use inline-grid so the bar width follows the wider of numerator/denominator.
          // Also keep the bar in its own row to avoid overlapping with √'s overline.
          <span className="inline-grid mx-1 align-middle justify-items-center" style={{ lineHeight: 1 }}>
            <span className="px-1" style={{ paddingBottom: '0.20em' }}>
              {renderContainer(node.numerator, [...path, 'numerator'])}
            </span>
            <span
              className="w-full border-t border-foreground/70"
              style={{ marginTop: '0.10em', marginBottom: '0.10em' }}
              aria-hidden="true"
            />
            {/* Extra top padding prevents the fraction bar from visually colliding with √ overlines in the denominator. */}
            <span className="px-1" style={{ paddingTop: '0.42em' }}>
              {renderContainer(node.denominator, [...path, 'denominator'])}
            </span>
          </span>
        );

      case 'superscript':
        return (
          <span className="inline-flex items-start">
            {renderContainer(node.base, [...path, 'base'])}
            <sup className="text-xs ml-0.5 leading-none">{renderContainer(node.exponent, [...path, 'exponent'])}</sup>
          </span>
        );

      case 'subscript':
        return (
          <span className="inline-flex items-center leading-none">
            {renderContainer(node.base, [...path, 'base'])}
            <sub className="text-xs ml-0.5 leading-none">{renderContainer(node.index, [...path, 'index'])}</sub>
          </span>
        );

      case 'sqrt':
        return (
          // iOS/Safari では inline 要素のベースライン計算が不安定になりやすいので、
          // √ 全体を「下寄せ」し、かつ中身を flex-end に揃えて見た目の基準線を安定させる。
          <span className="inline-block mx-0.5 align-bottom leading-none">
            <span className="inline-flex items-center leading-none">
              <span className="mr-0.5 leading-none">
                √
              </span>
              <span
                className="border-t border-foreground/70 px-0.5"
                // A bit more padding helps when √ appears under a fraction bar.
                style={{ paddingTop: '0.14em' }}
              >
                {renderContainer(node.content, [...path, 'content'])}
              </span>
            </span>
          </span>
        );

      case 'abs':
        return (
          <span className="inline-flex items-center mx-0.5">
            <span className="mx-0.5">|</span>
            {renderContainer(node.content, [...path, 'content'])}
            <span className="mx-0.5">|</span>
          </span>
        );

      case 'function':
        return (
          <span className="inline-flex items-baseline mx-0.5">
            <span className="font-mono">{node.name}</span>
            <span className="mx-0.5">(</span>
            {renderContainer(node.argument, [...path, 'argument'])}
            <span className="mx-0.5">)</span>
          </span>
        );

      case 'sum':
        return (
          <span className="inline-flex items-center mx-0.5">
            <span className="inline-flex flex-col items-center mr-1">
              <span className="text-base leading-none">∑</span>
              <sub className="text-[10px] leading-none">{renderContainer(node.lower, [...path, 'lower'])}</sub>
              <sup className="text-[10px] leading-none">{renderContainer(node.upper, [...path, 'upper'])}</sup>
            </span>
            {renderContainer(node.body, [...path, 'body'])}
          </span>
        );

      case 'integral':
        return (
          <span className="inline-flex items-center mx-0.5">
            <span className="inline-flex flex-col items-center mr-1">
              <span className="text-base leading-none">∫</span>
              <sub className="text-[10px] leading-none">{renderContainer(node.lower, [...path, 'lower'])}</sub>
              <sup className="text-[10px] leading-none">{renderContainer(node.upper, [...path, 'upper'])}</sup>
            </span>
            {renderContainer(node.body, [...path, 'body'])}
          </span>
        );

      default:
        return null;
    }
  };

  if (!root) {
    return fallback ? <span className={className}>{fallback}</span> : null;
  }

  return <span className={className}>{renderContainer(root, [])}</span>;
}
