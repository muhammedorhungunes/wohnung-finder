-- CreateEnum
CREATE TYPE "Platform" AS ENUM ('EBAY', 'IMMOSCOUT', 'IMMOWELT', 'WG_GESUCHT');

-- CreateTable
CREATE TABLE "filters" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "address" TEXT,
    "radius_km" DOUBLE PRECISION,
    "min_price" INTEGER,
    "max_price" INTEGER,
    "min_rooms" DOUBLE PRECISION,
    "max_rooms" DOUBLE PRECISION,
    "min_size_m2" DOUBLE PRECISION,
    "platforms" "Platform"[] DEFAULT ARRAY['EBAY']::"Platform"[],
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "whatsapp_number" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "filters_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "listings" (
    "id" TEXT NOT NULL,
    "platform" "Platform" NOT NULL,
    "external_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "price" DOUBLE PRECISION,
    "rooms" DOUBLE PRECISION,
    "size_m2" DOUBLE PRECISION,
    "address" TEXT,
    "city" TEXT,
    "lat" DOUBLE PRECISION,
    "lng" DOUBLE PRECISION,
    "url" TEXT NOT NULL,
    "images" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "first_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "is_notified" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "listings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "matches" (
    "filter_id" TEXT NOT NULL,
    "listing_id" TEXT NOT NULL,
    "notified_at" TIMESTAMP(3),

    CONSTRAINT "matches_pkey" PRIMARY KEY ("filter_id","listing_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "listings_platform_external_id_key" ON "listings"("platform", "external_id");

-- AddForeignKey
ALTER TABLE "matches" ADD CONSTRAINT "matches_filter_id_fkey" FOREIGN KEY ("filter_id") REFERENCES "filters"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "matches" ADD CONSTRAINT "matches_listing_id_fkey" FOREIGN KEY ("listing_id") REFERENCES "listings"("id") ON DELETE CASCADE ON UPDATE CASCADE;
