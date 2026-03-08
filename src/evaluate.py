"""
Evaluación del modelo U-Net en el Test Set (4 clases)
Urban Intelligence Platform - Fase 2
"""
import numpy as np
import torch
import torch.nn as nn
from torch.utils.data import Dataset, DataLoader, random_split
import segmentation_models_pytorch as smp
from pathlib import Path
import time
import json

DATA_DIR    = Path("/home/gdm3_escobar/urban-intelligence/data-local/processed")
MODEL_PATH  = Path("/home/gdm3_escobar/urban-intelligence/models/best_model.pth")
OUTPUT_DIR  = Path("/home/gdm3_escobar/urban-intelligence/results")
OUTPUT_DIR.mkdir(exist_ok=True)

NUM_CLASSES = 4
BATCH_SIZE  = 16
DEVICE      = torch.device("cuda" if torch.cuda.is_available() else "cpu")

CLASS_NAMES = {
    0: "Urbano/Construido",
    1: "Vegetación/Bosque",
    2: "Agua",
    3: "Suelo desnudo/Árido"
}

print(f"Device: {DEVICE}")
print(f"GPU: {torch.cuda.get_device_name(0) if torch.cuda.is_available() else 'None'}")

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
        mask[mask == 255] = 255
        mask[mask == 3] = 255
        mask[mask == 4] = 3
        return torch.from_numpy(image), torch.from_numpy(mask)

def compute_metrics(pred, target, num_classes=4):
    pred   = pred.argmax(dim=1).cpu().numpy().flatten()
    target = target.cpu().numpy().flatten()
    valid  = target != 255
    pred, target = pred[valid], target[valid]

    ious, precisions, recalls, f1s = [], [], [], []

    for c in range(num_classes):
        tp = ((pred == c) & (target == c)).sum()
        fp = ((pred == c) & (target != c)).sum()
        fn = ((pred != c) & (target == c)).sum()

        union = ((pred == c) | (target == c)).sum()
        iou = tp / union if union > 0 else 0.0
        ious.append(iou)

        precision = tp / (tp + fp) if (tp + fp) > 0 else 0.0
        recall    = tp / (tp + fn) if (tp + fn) > 0 else 0.0
        f1        = 2 * precision * recall / (precision + recall) if (precision + recall) > 0 else 0.0

        precisions.append(precision)
        recalls.append(recall)
        f1s.append(f1)

    return ious, precisions, recalls, f1s

def compute_confusion_matrix(pred, target, num_classes=4):
    pred   = pred.argmax(dim=1).cpu().numpy().flatten()
    target = target.cpu().numpy().flatten()
    valid  = target != 255
    pred, target = pred[valid], target[valid]

    cm = np.zeros((num_classes, num_classes), dtype=np.int64)
    for t, p in zip(target, pred):
        if t < num_classes and p < num_classes:
            cm[t][p] += 1
    return cm

print("\nCargando dataset")
dataset = LULCDataset(DATA_DIR)

n_val   = int(len(dataset) * 0.15)
n_test  = int(len(dataset) * 0.15)
n_train = len(dataset) - n_val - n_test
_, _, test_ds = random_split(dataset, [n_train, n_val, n_test],
                              generator=torch.Generator().manual_seed(42))

print(f"Test set: {len(test_ds)} muestras")
test_loader = DataLoader(test_ds, batch_size=BATCH_SIZE, shuffle=False,
                         num_workers=4, pin_memory=True)

print("\nCargando modelo...")
model = smp.Unet(
    encoder_name="efficientnet-b3",
    encoder_weights=None,
    in_channels=6,
    classes=NUM_CLASSES
).to(DEVICE)
model.load_state_dict(torch.load(MODEL_PATH, map_location=DEVICE))
model.eval()
print("Modelo cargado correctamente")

print("\nEvaluando en test set...")
start = time.time()

all_ious, all_precisions, all_recalls, all_f1s = [], [], [], []
total_cm = np.zeros((NUM_CLASSES, NUM_CLASSES), dtype=np.int64)
test_loss = 0.0

criterion = nn.CrossEntropyLoss(ignore_index=255)

with torch.no_grad():
    for i, (images, masks) in enumerate(test_loader):
        images, masks = images.to(DEVICE), masks.to(DEVICE)
        outputs = model(images)

        test_loss += criterion(outputs, masks).item()

        ious, precs, recs, f1s = compute_metrics(outputs, masks)
        all_ious.append(ious)
        all_precisions.append(precs)
        all_recalls.append(recs)
        all_f1s.append(f1s)

        total_cm += compute_confusion_matrix(outputs, masks)

        if (i + 1) % 200 == 0:
            print(f"  Batch {i+1}/{len(test_loader)}")

elapsed = time.time() - start
test_loss /= len(test_loader)

mean_ious       = np.mean(all_ious, axis=0)
mean_precisions = np.mean(all_precisions, axis=0)
mean_recalls    = np.mean(all_recalls, axis=0)
mean_f1s        = np.mean(all_f1s, axis=0)

print(f"\n{'='*70}")
print(f"RESULTADOS EN TEST SET ({len(test_ds)} muestras)")
print(f"{'='*70}")
print(f"Tiempo de evaluación: {elapsed:.0f}s")
print(f"Test Loss: {test_loss:.4f}")
print(f"mIoU: {np.mean(mean_ious):.4f}")
print(f"Mean F1: {np.mean(mean_f1s):.4f}")

print(f"\n{'─'*70}")
print(f"{'Clase':<25} {'IoU':>8} {'Precision':>10} {'Recall':>10} {'F1':>8}")
print(f"{'─'*70}")
for c in range(NUM_CLASSES):
    print(f"{CLASS_NAMES[c]:<25} {mean_ious[c]:>8.4f} {mean_precisions[c]:>10.4f} {mean_recalls[c]:>10.4f} {mean_f1s[c]:>8.4f}")
print(f"{'─'*70}")
print(f"{'PROMEDIO':<25} {np.mean(mean_ious):>8.4f} {np.mean(mean_precisions):>10.4f} {np.mean(mean_recalls):>10.4f} {np.mean(mean_f1s):>8.4f}")

print(f"\n{'─'*70}")
print("MATRIZ DE CONFUSIÓN (filas=real, columnas=predicción)")
print(f"{'─'*70}")

header = f"{'':>25}"
for c in range(NUM_CLASSES):
    header += f"  {CLASS_NAMES[c][:10]:>10}"
print(header)

for r in range(NUM_CLASSES):
    row = f"{CLASS_NAMES[r]:>25}"
    for c in range(NUM_CLASSES):
        row += f"  {total_cm[r][c]:>10,}"
    total = total_cm[r].sum()
    acc = total_cm[r][r] / total * 100 if total > 0 else 0
    row += f"  | {acc:.1f}%"
    print(row)

total_correct = np.diag(total_cm).sum()
total_pixels  = total_cm.sum()
overall_acc   = total_correct / total_pixels * 100

print(f"\nOverall Pixel Accuracy: {overall_acc:.2f}%")
print(f"Total píxeles evaluados: {total_pixels:,}")

results = {
    "num_classes": NUM_CLASSES,
    "class_names": CLASS_NAMES,
    "test_samples": len(test_ds),
    "test_loss": float(test_loss),
    "mIoU": float(np.mean(mean_ious)),
    "mean_f1": float(np.mean(mean_f1s)),
    "overall_pixel_accuracy": float(overall_acc),
    "evaluation_time_seconds": float(elapsed),
    "per_class": {}
}

for c in range(NUM_CLASSES):
    results["per_class"][CLASS_NAMES[c]] = {
        "iou": float(mean_ious[c]),
        "precision": float(mean_precisions[c]),
        "recall": float(mean_recalls[c]),
        "f1": float(mean_f1s[c])
    }

with open(OUTPUT_DIR / "test_results.json", "w") as f:
    json.dump(results, f, indent=2, ensure_ascii=False)

print(f"\nResultados guardados en: {OUTPUT_DIR / 'test_results.json'}")
print(f"{'='*70}")
print("EVALUACIÓN COMPLETADA")
print(f"{'='*70}")
