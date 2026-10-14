# Road-segmentation U-Net explorer

The portfolio explorer executes the project's saved `RouteGenerator2.h5` model locally with TensorFlow.js 4.22.0. Hidden maps are the outputs of the nine encoder/bottleneck/decoder blocks, after their second batch-normalization and ReLU pair. The tenth probe is the sigmoid prediction.

Source: the [implementation repository named in the final presentation](https://github.com/Aditya241097/Path-optimization-for-four-wheeled-robot-using-aerial-image-UNET-Architecture/tree/54c9a547d853de4cc6ea696e4fd1650537703aa7), commit `54c9a547d853de4cc6ea696e4fd1650537703aa7`, `ML Model/RouteGenerator2.h5`.

## Export

`model/model.json` uses the checkpoint's Keras topology. `Functional` is serialized as `Model` for TensorFlow.js, and each batch-normalization axis `[3]` is serialized as `3`. Model weights are copied bit-for-bit in little-endian float32. Only optimizer state is excluded. No retraining, quantization, or synthetic weights are used.

The saved checkpoint has 2,164,593 parameters, including 2,944 batch-normalization moving statistics, and dropout 0.07. At inference, dropout is inactive and saved moving statistics are used. The slides describe the architecture function's default dropout 0.1; the training notebook instantiates it with 0.07. Some later notebook loading cells specify 256-pixel inputs, while this checkpoint and the supplied inference node fix the input at 128 × 128 × 3.

`model/provenance.json` records source and weight SHA-256 checksums, input dimensions, and probe names. The browser downloads the 8.66 MB weights only when the explorer is visible or its run button is used. The pinned TensorFlow.js runtime is hosted at `../vendor/tfjs-4.22.0.min.js`, with its Apache 2.0 license alongside it.

## Images and preprocessing

`map27.png` and `map34.png` come from `src/robot_control/resource/map27.jpeg` and `Map34.jpg` in the source repository. They are decoded as RGB and resized to 128 × 128 using OpenCV `INTER_LINEAR`, following the JPEG inference path. Pixel values remain 0–255; there is no division by 255. PNG storage preserves those prepared input values exactly. User-selected images are resized by the browser; their pixels stay on the visitor's device.

The saved probability and mask PNGs are predictions computed from this exported checkpoint, rather than ground-truth labels or copies of slide figures. They keep the visualization useful before runtime loading or with JavaScript disabled. Live probability rendering uses a fixed 0–1 scale. Feature channels are independently scaled for display with original numerical ranges shown. A road mask uses the original code's strict `p > threshold` comparison. The mask in the explorer precedes morphology and planning.

## Validation

Both repository examples run successfully through the exported network. An independent NumPy implementation of the original HDF5 network—including batch normalization, transposed convolution, concatenation, and sigmoid—agrees with TensorFlow.js on Map 27 with maximum probability difference below 0.000004 and identical binary masks at threshold 0.5. TensorFlow.js forward passes release their input and output tensors after copying the data needed for inspection.

These examples demonstrate execution of the saved project artifact. They are not a held-out accuracy evaluation. The original presentation figures, A* teaching grid, and robot recording retain their own source labels.
