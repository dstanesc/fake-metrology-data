# Fake Metrology Data Generator

Generate fake metrology data for testing and benchmarks.

## Usage

Single part report, configured with the number of measurements to include `{reportSize: 300}`. The size is unconstrained
```js
import {
    partReport
} from '@dstanesc/fake-metrology-data'
const reportData = partReport({reportSize: 300})
const reportText = JSON.stringify(reportData, null, 2);
```

More complex multipart report, configured with the number of parts to be generated (`assemblySize: 10`), the minimum number of measurements to be generated for the individual parts (`minReportSize: 500`), and the maximum number of measurements to be generated for the individual parts (`maxReportSize: 1000`)
```js
import {
    multipartReport
} from '@dstanesc/fake-metrology-data'
const reportData = multipartReport({ assemblySize: 10, minReportSize: 500, maxReportSize: 1000})
const reportText = JSON.stringify(reportData, null, 2);
```

## Disclaimer

This project has adopted the [Microsoft Open Source Code of Conduct](https://opensource.microsoft.com/codeofconduct/).
For more information see the [Code of Conduct FAQ](https://opensource.microsoft.com/codeofconduct/faq/) or contact
[opencode@microsoft.com](mailto:opencode@microsoft.com) with any additional questions or comments.

This project may contain Microsoft trademarks or logos for Microsoft projects, products, or services. Use of these
trademarks or logos must follow Microsoft’s [Trademark & Brand Guidelines](https://www.microsoft.com/trademarks). Use of
Microsoft trademarks or logos in modified versions of this project must not cause confusion or imply Microsoft
sponsorship.
