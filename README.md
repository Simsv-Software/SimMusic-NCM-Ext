# SimMusic NCM 扩展
本项目是 [SimMusic](https://github.com/Simsv-Software/SimMusic2024) 的扩展，支持接入 `网易云 NodeJS API`。

## 提示
目前本项目适配 SimMusic 0.1.0 版本，请勿跨版本使用。

<small><i>(2024/08/17)</i> 注: 以往提交记录中的 `0.4` 版本为误写，实际为 `0.0.4` 版本。</small>

## 声明
本项目**不**提供 API 服务，您需要一个预先搭建好的 API 才能使用。

本项目**不**提供任何方法对网易云服务进行破解，**仅**供学习和个人研究用途使用，用户因（不限于）使用、分发等行为产生的任何**后果**与 Simsv-Software 组织 **无关**。

本项目与网易公司（网易云音乐版权所有者）**无关**。

## 使用
*注意，您可能需要一个良好的网络环境。*

### 预先构建
您可以前往 [最新 Releases](https://github.com/simsv-software/SimMusic-NCM-Ext/releases/latest) 页面，下载 `extension.zip`。

然后，将它拖入 SimMusic 扩展页面，即可完成安装。

### 手动构建
您还可以手动进行构建来使用最新版本，具体步骤如下。

首先，运行以下命令：

```shell
git clone https://github.com/simsv-software/SimMusic-NCM-Ext --depth 1
cd SimMusic-NCM-Ext
npm i
npm run build
```

然后，打开项目中的 `dist` 文件夹，将 `extension.zip` 拖入 SimMusic 扩展页面，即可完成安装。

## 问题反馈
若您发现了问题或有好的意见，请开启一个 `issue`。

若您能够帮助我们解决问题，我们欢迎您提出 `Pull Request`。

## 协议
本项目使用 MIT 协议进行分发，具体内容请查看 [协议文件](/LICENSE)。
