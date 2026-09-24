import React from 'react';
import { Package, Percent, ExternalLink } from 'lucide-react';
import { calculateTaxable, formatEuro } from '../utils/priceUtils';

export interface ProductCardProps {
  product: {
    id: number;
    code: string;
    description: string;
    price: number | string;
    stock: number | string;
    um?: string | null;
    vat_code?: string | number | null;
    image_file_name?: string | null;
    category?: string | null;
    subcategory?: string | null;
    link?: string | null;
    classe_provvigione?: string | null;
    online_customized?: number | boolean;
  };
  qtyInCart?: number;
  onAddToCart?: (product: any) => void;
  onSelect?: (product: any) => void;
  className?: string;
}

export const ProductCard: React.FC<ProductCardProps> = ({
  product,
  qtyInCart = 0,
  onAddToCart,
  onSelect,
  className = '',
}) => {
  const isAvailable = Number(product.stock) > 0;
  // Always use net taxable price properties, ignoring any gross price fields
  const netPrice = Number(
    (product as any).net_price ?? 
    (product as any).net_price_1 ?? 
    product.price ?? 
    0
  ) || 0;
  const imageUrl = product.image_file_name
    ? `/uploads/${encodeURIComponent(product.image_file_name.trim())}`
    : null;

  return (
    <div
      onClick={() => onSelect && onSelect(product)}
      className={`bg-white rounded-2xl border p-4 flex flex-col justify-between transition-all hover:shadow-md cursor-pointer ${
        qtyInCart > 0
          ? 'border-[#5A5A40] ring-2 ring-[#5A5A40]/15'
          : 'border-gray-200/80 shadow-xs'
      } ${className}`}
    >
      <div>
        {/* Top Image or Placeholder */}
        <div className="relative aspect-4/3 rounded-xl bg-gray-50 border border-gray-100 overflow-hidden mb-3 flex items-center justify-center">
          {imageUrl ? (
            <img
              src={imageUrl}
              alt={product.description}
              loading="lazy"
              decoding="async"
              className="w-full h-full object-contain p-2"
              referrerPolicy="no-referrer"
              onError={(e: any) => {
                e.currentTarget.style.display = 'none';
                const next = e.currentTarget.nextSibling as HTMLElement;
                if (next) next.style.display = 'flex';
              }}
            />
          ) : null}
          <div
            className={`flex flex-col items-center justify-center text-gray-300 ${
              imageUrl ? 'hidden' : 'flex'
            }`}
          >
            <Package size={32} />
            <span className="text-[10px] text-gray-400 font-bold mt-1">Connect</span>
          </div>

          {/* Stock Status Badge */}
          <div className="absolute top-2 left-2">
            {isAvailable ? (
              <span className="bg-emerald-600/90 text-white text-[10px] font-bold px-2 py-0.5 rounded-md shadow-2xs backdrop-blur-xs">
                Disp. ({product.stock} {product.um || 'pz'})
              </span>
            ) : (
              <span className="bg-amber-500/90 text-white text-[10px] font-bold px-2 py-0.5 rounded-md shadow-2xs backdrop-blur-xs">
                In arrivo / Pre-ordine
              </span>
            )}
          </div>

          {/* Quantity already in cart badge */}
          {qtyInCart > 0 && (
            <div className="absolute top-2 right-2 bg-[#5A5A40] text-white text-[10px] font-black px-2 py-0.5 rounded-md shadow-2xs">
              Nel Carrello: {qtyInCart}
            </div>
          )}
        </div>

        {/* Code & Category */}
        <div className="flex items-center gap-1.5 mb-1.5 flex-wrap">
          <span className="font-mono text-[9px] bg-indigo-50 text-indigo-700 font-bold px-1.5 py-0.5 rounded border border-indigo-100">
            {product.code}
          </span>
          {product.category && (
            <span className="text-[9px] font-bold uppercase tracking-wider text-[#5A5A40] truncate max-w-[120px]">
              {product.category}
            </span>
          )}
        </div>

        {/* Title */}
        <h4 className="text-xs font-bold text-gray-900 line-clamp-2 leading-relaxed mb-2" title={product.description}>
          {product.description}
        </h4>
      </div>

      {/* Pricing and Action Footer */}
      <div className="pt-3 border-t border-gray-100 flex items-center justify-between mt-auto">
        <div>
          <span className="text-[9px] text-gray-400 uppercase font-semibold block">Prezzo Base</span>
          <div className="flex items-baseline gap-1">
            <span className="text-sm font-serif font-black text-[#5A5A40] leading-tight">
              {formatEuro(netPrice)}
            </span>
            <span className="text-[10px] font-sans font-medium text-gray-500">(Imponibile)</span>
          </div>
        </div>

        {onAddToCart && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onAddToCart(product);
            }}
            className="bg-[#5A5A40] hover:bg-[#4A4A30] text-white text-xs font-bold px-3 py-1.5 rounded-xl transition-all shadow-2xs flex items-center gap-1 cursor-pointer"
          >
            + Aggiungi
          </button>
        )}
      </div>
    </div>
  );
};

export default ProductCard;
