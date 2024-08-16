# SimMusic NCM 扩展
本项目是 [SimMusic](https://github.com/Simsv-Software/SimMusic2024) 的扩展，支持接入`网易云 NodeJS API`。

## 提示
目前本项目适配 SimMusic 0.4 版本，请勿跨版本使用。

## 声明
本项目**不**提供 API 服务，您需要一个预先搭建好的 API 才能使用。

本项目**不**提供任何方法对网易云服务进行破解，**仅**供学习和个人研究用途使用，用户因（不限于）使用、分发等行为产生的任何**后果**与 Simsv-Software 组织 **无关**。

本项目与网易公司（网易云音乐版权所有者）**无关**。

## 使用
### 预先构建
点击添加扩展，输入 `https://simsv.com/sim-music/extensions/ncm/manifest.json`，点击确定即可。

*注意，为了兼容，扩展将不会自动更新，若您需要更新至最新版本，请删除扩展后重新添加。*

### 手动构建
您还可以手动进行构建来使用最新版本，具体步骤如下。

*注意，您可能需要一个良好的网络环境。*

首先，运行以下命令：

```shell
git clone https://github.com/simsv-software/SimMusic-NCM-Ext --depth 1
cd SimMusic-NCM-Ext
npm i
npm run build
```

然后，打开 SimMusic，点击左栏 `扩展`，点击 `添加扩展`。

输入 `file:// + manifest.json 的绝对路径`（e.g. `file://D:/SimMusic-NCM-Ext/manifest.json`），点击 `确定`，添加扩展。

## 问题反馈
若您发现了问题或有好的意见，请开启一个 `issue`。

若您能够帮助我们解决问题，我们欢迎您提出 `Pull Request`。

## 协议
本项目使用 MIT 协议进行分发，具体内容请查看 [协议文件](/LICENSE)。
