import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Platform, Device, Social, Store, MonetizationModel, UserSpan } from './entities/index';

@Injectable()
export class ReferenceService {
  constructor(
    @InjectRepository(Platform) private platformsRepo: Repository<Platform>,
    @InjectRepository(Device) private devicesRepo: Repository<Device>,
    @InjectRepository(Social) private socialsRepo: Repository<Social>,
    @InjectRepository(Store) private storesRepo: Repository<Store>,
    @InjectRepository(MonetizationModel) private monetizationRepo: Repository<MonetizationModel>,
    @InjectRepository(UserSpan) private userSpansRepo: Repository<UserSpan>,
  ) {}

  getPlatforms() {
    return this.platformsRepo.find();
  }

  getDevices() {
    return this.devicesRepo.find();
  }

  getSocials() {
    return this.socialsRepo.find();
  }

  getStores() {
    return this.storesRepo.find();
  }

  getMonetizationModels() {
    return this.monetizationRepo.find();
  }

  getUserSpans() {
    return this.userSpansRepo.find();
  }
}
