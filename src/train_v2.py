"""
Urban Intelligence Platform - Fase 2
Entrenamiento U-Net para clasificación LULC (4 clases)
Clases: 0=Urbano, 1=Vegetación, 2=Agua, 3=Suelo desnudo
"""
import numpy as np
import torch
import torch.nn as nn
from torch.utils.data import Dataset, DataLoader, random_split
import segmentation_models_pytorch as smp
from pathlib import Path
import time

DATA_DIR    = Path("/home/gdm3_escobar/urban-intelligence/data-local/processed")
MODEL_DIR   = Path("/home/gdm3_escobar/urban-intelligence/models")
MODEL_DIR.mkdir(exist_ok=True)

BATCH_SIZE  = 16
EPOCHS      = 50
LR          = 1e-4
NUM_CLASSES = 4
DEVICE      = torch.device("cuda" if torch.cuda.is_available() else "cpu")

print(f"Device: {DEVICE}")
print(f"GPU: {torch.cuda.get_device_name(0) if torch.cuda.is_available() else 'None'}")
print(f"Clases: {NUM_CLASSES} (Urbano, Vegetación, Agua, Suelo desnudo)")

class LULCDataset(Dataset):
    def __init__(self, data_dir):
        self.samples = []
        for scene_dir in sorted(data_dir.iterdir()):
            if not scene_dir.is_dir():
                continue
            for img_path in sorted(scene_dir.glob("img_*.npy")):
                mask_path = scene_dir / img_path.name.replace("img_", "mask_")
                if mask_path.exists():
                    self.samples.append((img_path, mask_path))
        print(f"Total samples: {len(self.samples)}")

    def __len__(self):
        return len(self.samples)

    def __getitem__(self, idx):
        img_path, mask_path = self.samples[idx]
        image = np.load(img_path).astype(np.float32)
        mask  = np.load(mask_path).astype(np.int64)
        # Remapear clases:
        # 0=Urbano (sin cambio), 1=Vegetación (sin cambio), 2=Agua (sin cambio)
        # 3=Industrial → ignorar (255), 4=Suelo desnudo → 3
        mask[mask == 255] = 255  # mantener no-data
        mask[mask == 3] = 255    # Industrial no existe, ignorar
        mask[mask == 4] = 3      # Suelo desnudo pasa a clase 3
        return torch.from_numpy(image), torch.from_numpy(mask)

class CombinedLoss(nn.Module):
    def __init__(self):
        super().__init__()
        self.ce   = nn.CrossEntropyLoss(ignore_index=255)
        self.dice = smp.losses.DiceLoss(mode="multiclass", ignore_index=255)
    def forward(self, pred, target):
        return 0.5 * self.ce(pred, target) + 0.5 * self.dice(pred, target)

def compute_miou(pred, target, num_classes=4):
    pred   = pred.argmax(dim=1).cpu().numpy().flatten()
    target = target.cpu().numpy().flatten()
    valid  = target != 255
    pred, target = pred[valid], target[valid]
    ious = []
    for c in range(num_classes):
        intersection = ((pred == c) & (target == c)).sum()
        union        = ((pred == c) | (target == c)).sum()
        if union > 0:
            ious.append(intersection / union)
    return np.mean(ious) if ious else 0.0

def main():
    print("Cargando dataset...")
    dataset = LULCDataset(DATA_DIR)
    n_val   = int(len(dataset) * 0.15)
    n_test  = int(len(dataset) * 0.15)
    n_train = len(dataset) - n_val - n_test
    train_ds, val_ds, _ = random_split(dataset, [n_train, n_val, n_test],
                                        generator=torch.Generator().manual_seed(42))
    print(f"Train: {len(train_ds)} | Val: {len(val_ds)}")

    train_loader = DataLoader(train_ds, batch_size=BATCH_SIZE, shuffle=True,
                              num_workers=4, pin_memory=True)
    val_loader   = DataLoader(val_ds,   batch_size=BATCH_SIZE, shuffle=False,
                              num_workers=4, pin_memory=True)

    print("Inicializando modelo...")
    model = smp.Unet(
        encoder_name="efficientnet-b3",
        encoder_weights="imagenet",
        in_channels=6,
        classes=NUM_CLASSES
    ).to(DEVICE)

    optimizer = torch.optim.AdamW(model.parameters(), lr=LR, weight_decay=1e-4)
    scheduler = torch.optim.lr_scheduler.CosineAnnealingLR(optimizer, T_max=EPOCHS)
    criterion = CombinedLoss()

    best_miou  = 0.0
    no_improve = 0

    print(f"\nIniciando entrenamiento {EPOCHS} epocas...")
    print("=" * 60)

    for epoch in range(1, EPOCHS + 1):
        start = time.time()

        # Train
        model.train()
        train_loss = 0.0
        for images, masks in train_loader:
            images, masks = images.to(DEVICE), masks.to(DEVICE)
            optimizer.zero_grad()
            loss = criterion(model(images), masks)
            loss.backward()
            optimizer.step()
            train_loss += loss.item()
        train_loss /= len(train_loader)

        # Validation
        model.eval()
        val_loss = val_miou = 0.0
        with torch.no_grad():
            for images, masks in val_loader:
                images, masks = images.to(DEVICE), masks.to(DEVICE)
                outputs   = model(images)
                val_loss += criterion(outputs, masks).item()
                val_miou += compute_miou(outputs, masks)
        val_loss /= len(val_loader)
        val_miou /= len(val_loader)

        scheduler.step()

        elapsed = time.time() - start
        print(f"Epoca {epoch:02d}/{EPOCHS} | Loss: {train_loss:.4f} | "
              f"Val Loss: {val_loss:.4f} | mIoU: {val_miou:.4f} | {elapsed:.0f}s")

        if val_miou > best_miou:
            best_miou  = val_miou
            no_improve = 0
            torch.save(model.state_dict(), MODEL_DIR / "best_model.pth")
            print(f"  Mejor modelo guardado: mIoU={best_miou:.4f}")
        else:
            no_improve += 1
            if no_improve >= 10:
                print(f"Early stopping en epoca {epoch}")
                break

    print("=" * 60)
    print(f"Entrenamiento completo. Mejor mIoU: {best_miou:.4f}")

if __name__ == "__main__":
    main()
